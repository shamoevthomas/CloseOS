import { useState, useMemo, useEffect } from 'react'
import { CreditCard, TrendingUp, DollarSign, Calendar, FileText, Wallet, Building2 } from 'lucide-react'
import { useProspects } from '../contexts/ProspectsContext'
import { useOffers } from '../contexts/OffersContext'
import { InvoiceGeneratorModal } from '../components/InvoiceGeneratorModal'
import { PaymentMethodsModal } from '../components/PaymentMethodsModal'
import { IssuerProfilesModal } from '../components/IssuerProfilesModal'
import { supabase } from '../lib/supabase'

export function InvoicesPage() {
  const { prospects } = useProspects()
  const { offers } = useOffers()

  // New state for table history
  const [savedInvoices, setSavedInvoices] = useState<any[]>([])

  // Get current month as default date range
  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const [startDate, setStartDate] = useState(firstDayOfMonth.toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(lastDayOfMonth.toISOString().split('T')[0])
  const [selectedOfferId, setSelectedOfferId] = useState<number | null>(null)
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false)
  const [isPaymentMethodsOpen, setIsPaymentMethodsOpen] = useState(false)
  const [isIssuerProfilesOpen, setIsIssuerProfilesOpen] = useState(false)

  // Fetch invoices from Supabase
  const fetchInvoices = async () => {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setSavedInvoices(data)
  }

  useEffect(() => {
    fetchInvoices()
  }, [isGeneratorOpen]) // Refresh when modal is closed (potential new invoice)

  // Get active offers
  const activeOffers = offers.filter((offer) => offer.status === 'active')

  // Set default selected offer
  if (selectedOfferId === null && activeOffers.length > 0) {
    setSelectedOfferId(activeOffers[0].id)
  }

  // Find selected offer
  const selectedOffer = activeOffers.find((offer) => offer.id === selectedOfferId)

  // Calculate stats for selected offer and date range
  const stats = useMemo(() => {
    if (!selectedOffer) {
      return { revenue: 0, commission: 0, dealsCount: 0 }
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999) // Include the entire end date

    // Filter prospects that are "Won" in the date range and match the offer
    const wonProspects = prospects.filter((prospect) => {
      // Check if it's a won deal
      if (prospect.stage !== 'won') return false

      // Check date range (using lastContact as deal close date)
      if (prospect.lastContact) {
        const closeDate = new Date(prospect.lastContact)
        if (closeDate < start || closeDate > end) return false
      } else {
        return false // Skip if no close date
      }

      // Check if it matches the offer (by ID first, then fallback to name matching)
      if (
        prospect.offerId === selectedOffer.id ||
        String(prospect.offerId) === String(selectedOffer.id) ||
        prospect.offer === selectedOffer.name ||
        prospect.title?.includes(selectedOffer.name)
      ) {
        return true
      }

      return false
    })

    // Calculate revenue
    const revenue = wonProspects.reduce((sum, prospect) => sum + (prospect.value || 0), 0)

    // Calculate commission with robust fallback logic
    const totalCommission = wonProspects.reduce((sum, deal) => {
      const amount = deal.value || 0

      // Robust rate extraction (handles "15", "15%", or 0.15)
      let rate = 0.10 // Default 10%
      if (selectedOffer?.commission) {
        const commissionStr = String(selectedOffer.commission)
        if (commissionStr.includes('%')) {
          const match = commissionStr.match(/(\d+(?:\.\d+)?)/)
          if (match) rate = parseFloat(match[1]) / 100
        } else if (commissionStr.includes('€')) {
          // Fixed commission per deal
          return sum + parseFloat(commissionStr.replace('€', ''))
        } else {
          // Try parsing as plain number
          const match = commissionStr.match(/(\d+(?:\.\d+)?)/)
          if (match) rate = parseFloat(match[1]) / 100
        }
      }

      return sum + (amount * rate)
    }, 0)

    const commission = totalCommission

    return {
      revenue,
      commission,
      dealsCount: wonProspects.length,
      deals: wonProspects,
    }
  }, [prospects, selectedOffer, startDate, endDate])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-black p-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-white">Factures & Commissions</h1>
          <p className="text-slate-400">Générez vos factures et suivez vos commissions</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsIssuerProfilesOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-800 hover:border-slate-600"
          >
            <Building2 className="h-4 w-4" />
            Infos Émetteur
          </button>
          <button
            onClick={() => setIsPaymentMethodsOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-800 hover:border-slate-600"
          >
            <Wallet className="h-4 w-4" />
            Moyens de Paiement
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="mb-6 flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <Calendar className="h-5 w-5 text-purple-400" />
        <div className="flex items-center gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Date de début</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
            />
          </div>
          <div className="mt-5 text-slate-600">→</div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Date de fin</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Offer Tabs */}
      {activeOffers.length > 0 && (
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {activeOffers.map((offer) => (
            <button
              key={offer.id}
              onClick={() => setSelectedOfferId(offer.id)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                selectedOfferId === offer.id
                  ? 'bg-purple-500 text-white'
                  : 'border border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {offer.name}
            </button>
          ))}
        </div>
      )}

      {/* Stats Cards */}
      {selectedOffer ? (
        <div className="mb-8 grid gap-6 md:grid-cols-3">
          {/* Revenue Card */}
          <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-blue-500/10 to-blue-600/10 p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-full bg-blue-500/20 p-3">
                <TrendingUp className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-400">CA Généré</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(stats.revenue)}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500">{stats.dealsCount} deal(s) gagné(s)</p>
          </div>

          {/* Commission Card */}
          <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-full bg-emerald-500/20 p-3">
                <DollarSign className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-400">Ma Commission</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(stats.commission)}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500">Taux: {selectedOffer.commission}</p>
          </div>

          {/* Quick Stats */}
          <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-purple-500/10 to-purple-600/10 p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-full bg-purple-500/20 p-3">
                <CreditCard className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-400">Commission Moy.</p>
                <p className="text-2xl font-bold text-white">
                  {stats.dealsCount > 0
                    ? formatCurrency(stats.commission / stats.dealsCount)
                    : formatCurrency(0)}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-500">Par deal fermé</p>
          </div>
        </div>
      ) : (
        <div className="mb-8 rounded-xl border border-slate-800 bg-slate-900/50 p-12 text-center">
          <FileText className="mx-auto mb-4 h-12 w-12 text-slate-600" />
          <p className="text-lg font-semibold text-slate-400">Aucune offre active</p>
          <p className="mt-2 text-sm text-slate-500">
            Créez une offre active pour commencer à générer des factures
          </p>
        </div>
      )}

      {/* Generate Invoice Button */}
      {selectedOffer && stats.dealsCount > 0 && (
        <div className="flex justify-center mb-12">
          <button
            onClick={() => setIsGeneratorOpen(true)}
            className="group flex items-center gap-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 px-8 py-4 text-lg font-bold text-white shadow-lg transition-all hover:scale-105 hover:shadow-purple-500/50"
          >
            <FileText className="h-6 w-6" />
            Générer Facture
          </button>
        </div>
      )}

      {/* History Table Section */}
      <div className="mt-12">
        <h2 className="mb-4 text-xl font-bold text-white">Historique des factures</h2>
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 shadow-lg">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-800/50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-6 py-4">N° Facture</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Client / Offre</th>
                <th className="px-6 py-4">Montant TTC</th>
                <th className="px-6 py-4">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {savedInvoices.map((inv) => (
                <tr key={inv.id} className="transition-colors hover:bg-slate-800/30">
                  <td className="px-6 py-4 font-mono font-medium text-purple-400">{inv.invoice_number}</td>
                  <td className="px-6 py-4">{new Date(inv.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-white">{inv.client_name}</div>
                    <div className="text-xs text-slate-500">{inv.offer_name}</div>
                  </td>
                  <td className="px-6 py-4 font-bold text-white">{formatCurrency(inv.amount_ttc)}</td>
                  <td className="px-6 py-4">
                    <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400">
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
              {savedInvoices.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-500 italic">
                    Aucune facture enregistrée dans l'historique.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* No Deals Message */}
      {selectedOffer && stats.dealsCount === 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-12 text-center mt-6">
          <FileText className="mx-auto mb-4 h-12 w-12 text-slate-600" />
          <p className="text-lg font-semibold text-slate-400">Aucun deal gagné</p>
          <p className="mt-2 text-sm text-slate-500">
            Fermez des deals pour générer des factures dans cette période
          </p>
        </div>
      )}

      {/* Invoice Generator Modal */}
      {isGeneratorOpen && selectedOffer && (
        <InvoiceGeneratorModal
          offer={selectedOffer}
          deals={stats.deals || []}
          commission={stats.commission}
          startDate={startDate}
          endDate={endDate}
          onClose={() => setIsGeneratorOpen(false)}
        />
      )}

      {/* Payment Methods Modal */}
      <PaymentMethodsModal
        isOpen={isPaymentMethodsOpen}
        onClose={() => setIsPaymentMethodsOpen(false)}
      />

      {/* Issuer Profiles Modal */}
      <IssuerProfilesModal
        isOpen={isIssuerProfilesOpen}
        onClose={() => setIsIssuerProfilesOpen(false)}
      />
    </div>
  )
}