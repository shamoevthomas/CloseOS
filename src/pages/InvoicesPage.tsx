import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CreditCard, TrendingUp, DollarSign, Calendar, FileText, Wallet, Building2, Eye, Download, Info, Clock, Zap } from 'lucide-react'
import { useProspects } from '../contexts/ProspectsContext'
import { useOffers } from '../contexts/OffersContext'
import { InvoiceGeneratorModal } from '../components/InvoiceGeneratorModal'
import { PaymentMethodsModal } from '../components/PaymentMethodsModal'
import { IssuerProfilesModal } from '../components/IssuerProfilesModal'
import { StripeConnectModal } from '../components/StripeConnectModal'
import { InvoiceDetailModal } from '../components/InvoiceDetailModal'
import { AutoInvoiceConfigModal } from '../components/AutoInvoiceConfigModal'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function InvoicesPage() {
  const { prospects } = useProspects()
  const { offers } = useOffers()
  const { user } = useAuth()

  const [searchParams] = useSearchParams()

  const [savedInvoices, setSavedInvoices] = useState<any[]>([])

  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const [startDate, setStartDate] = useState(firstDayOfMonth.toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(lastDayOfMonth.toISOString().split('T')[0])
  const [selectedOfferId, setSelectedOfferId] = useState<number | null>(null)
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false)
  const [isPaymentMethodsOpen, setIsPaymentMethodsOpen] = useState(false)
  const [isIssuerProfilesOpen, setIsIssuerProfilesOpen] = useState(false)
  const [isStripeConnectOpen, setIsStripeConnectOpen] = useState(false)
  const [isAutoInvoiceOpen, setIsAutoInvoiceOpen] = useState(false)

  // ÉTATS POUR LE NOUVEAU MODAL
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const [activeTooltip, setActiveTooltip] = useState<'cash' | 'installments' | null>(null)

  const fetchInvoices = async () => {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setSavedInvoices(data)
  }

  // On recharge aussi quand le détail se ferme pour être sûr d'avoir le nouveau statut
  useEffect(() => {
    fetchInvoices()
  }, [isGeneratorOpen, isDetailOpen])

  useEffect(() => {
    let isMounted = true;
    if (searchParams.get('stripe_connected') === 'true' && user) {
      const confirmConnection = async () => {
        await supabase
          .from('profiles')
          .update({ stripe_connected: true })
          .eq('id', user.id);

        if (!isMounted) return;

        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);

        setIsStripeConnectOpen(true);
      };
      confirmConnection();
    }
    return () => { isMounted = false };
  }, [searchParams, user?.id]);

  const isExpired = (offer: any) => {
    if (!offer.endDate) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const end = new Date(offer.endDate)
    return end < today
  }

  const activeOffers = offers.filter((offer) => offer.status === 'active' && !isExpired(offer))

  if (selectedOfferId === null && activeOffers.length > 0) {
    setSelectedOfferId(activeOffers[0].id)
  }

  const selectedOffer = activeOffers.find((offer) => offer.id === selectedOfferId)

  // --- 🚀 NOUVEAU CALCUL : PAIEMENTS EN ATTENTE ---
  const pendingStats = useMemo(() => {
    const pendingInvoices = savedInvoices.filter(inv =>
      ['en_attente', 'retard', 'autre'].includes(inv.status) ||
      inv.status === 'en attente' // Compatibilité au cas où
    );

    const totalPending = pendingInvoices.reduce((sum, inv) => sum + (inv.amount_ttc || 0), 0);

    return {
      amount: totalPending,
      count: pendingInvoices.length
    };
  }, [savedInvoices]);
  // ------------------------------------------------

  const stats = useMemo(() => {
    if (!selectedOffer) {
      return { revenue: 0, commission: 0, dealsCount: 0, deals: [], cashDeals: [], installmentDeals: [] }
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)

    const activeDealsInPeriod = prospects.filter((prospect) => {
      if (prospect.stage !== 'won') return false

      const isCorrectOffer = prospect.offer_id === selectedOffer.id ||
        String(prospect.offer_id) === String(selectedOffer.id) ||
        prospect.offer === selectedOffer.name ||
        prospect.title?.includes(selectedOffer.name)

      if (!isCorrectOffer) return false

      const dealDate = new Date(prospect.lastContact || prospect.dateAdded || "")

      if (prospect.payment_type !== 'installments' && (!prospect.installments || prospect.installments <= 1)) {
        return dealDate >= start && dealDate <= end
      }

      const months = prospect.installments || 1
      const endDateDeal = new Date(dealDate)
      endDateDeal.setMonth(endDateDeal.getMonth() + (months - 1))

      return (dealDate <= end && endDateDeal >= start)
    })

    const cashDeals = activeDealsInPeriod.filter(p => p.payment_type !== 'installments' && (!p.installments || p.installments <= 1))
    const installmentDeals = activeDealsInPeriod.filter(p => p.payment_type === 'installments' || (p.installments && p.installments > 1))

    const revenue = activeDealsInPeriod.reduce((sum, prospect) => {
      const fullValue = prospect.value || 0

      if (prospect.payment_type !== 'installments' && (!prospect.installments || prospect.installments <= 1)) {
        return sum + fullValue
      } else {
        const monthlyValue = fullValue / (prospect.installments || 1)
        let installmentsInPeriod = 0
        const dealDate = new Date(prospect.lastContact || prospect.dateAdded || "")

        for (let i = 0; i < (prospect.installments || 1); i++) {
          const installmentDate = new Date(dealDate)
          installmentDate.setMonth(installmentDate.getMonth() + i)
          if (installmentDate >= start && installmentDate <= end) {
            installmentsInPeriod++
          }
        }
        return sum + (monthlyValue * installmentsInPeriod)
      }
    }, 0)

    const totalCommission = activeDealsInPeriod.reduce((sum, deal) => {
      let amountInPeriod = 0
      const fullValue = deal.value || 0

      if (deal.payment_type !== 'installments' && (!deal.installments || deal.installments <= 1)) {
        amountInPeriod = fullValue
      } else {
        const monthlyValue = fullValue / (deal.installments || 1)
        const dealDate = new Date(deal.lastContact || deal.dateAdded || "")
        for (let i = 0; i < (deal.installments || 1); i++) {
          const installmentDate = new Date(dealDate)
          installmentDate.setMonth(installmentDate.getMonth() + i)
          if (installmentDate >= start && installmentDate <= end) {
            amountInPeriod += monthlyValue
          }
        }
      }

      let rate = 0.10
      const commissionStr = String(selectedOffer?.commission || "10")
      const match = commissionStr.match(/(\d+(?:\.\d+)?)/)
      if (match) rate = parseFloat(match[1]) / 100

      return sum + (amountInPeriod * rate)
    }, 0)

    return {
      revenue,
      commission: totalCommission,
      dealsCount: activeDealsInPeriod.length,
      deals: activeDealsInPeriod,
      cashDeals,
      installmentDeals
    }
  }, [prospects, selectedOffer, startDate, endDate])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  const getInstallmentEndDate = (startDateStr: string | Date, months: number) => {
    if (!startDateStr) return 'N/A'
    const d = new Date(startDateStr)
    d.setMonth(d.getMonth() + (months - 1))
    return d.toLocaleDateString('fr-FR')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'payé': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'envoyée': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'générée': return 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20';
      case 'retard': return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      case 'en attente': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'en_attente': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20'; // Correction doublon
      default: return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
    }
  };

  return (
    <div className="relative min-h-screen bg-[#020617] p-8 overflow-hidden font-sans text-slate-100" onClick={() => setActiveTooltip(null)}>

      {/* Background Blobs (Style Landing Page) */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/10 opacity-30 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-purple-600/10 opacity-20 blur-[100px] rounded-full pointer-events-none mix-blend-screen" />

      <div className="relative mx-auto max-w-7xl space-y-8 z-10">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Factures & Commissions</h1>
            <p className="mt-1 text-slate-400">Générez vos factures et suivez vos commissions</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => setIsAutoInvoiceOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5 text-sm font-bold text-white transition-all hover:shadow-lg hover:shadow-amber-500/20 active:scale-95"
            >
              <Zap className="h-4 w-4" />
              Facturation Auto
            </button>
            <button
              onClick={() => setIsStripeConnectOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-[#635BFF] px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-[#5349E0] hover:shadow-lg hover:shadow-[#635BFF]/20 active:scale-95"
            >
              <CreditCard className="h-4 w-4" />
              Connecter Stripe
            </button>

            <button
              onClick={() => setIsIssuerProfilesOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/50 px-5 py-2.5 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-800 hover:text-white backdrop-blur-sm"
            >
              <Building2 className="h-4 w-4" />
              Infos Émetteur
            </button>
            <button
              onClick={() => setIsPaymentMethodsOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/50 px-5 py-2.5 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-800 hover:text-white backdrop-blur-sm"
            >
              <Wallet className="h-4 w-4" />
              Moyens de Paiement
            </button>
          </div>
        </div>

        {/* DATE PICKER (Glass) */}
        <div className="flex flex-col md:flex-row items-center gap-6 rounded-3xl border border-white/5 bg-slate-900/40 p-6 backdrop-blur-md shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-500/20 border border-purple-500/20">
              <Calendar className="h-5 w-5 text-purple-400" />
            </div>
            <span className="font-bold text-white">Période :</span>
          </div>
          <div className="flex items-center gap-4 flex-1">
            <div className="flex-1">
              <label className="mb-2 block text-xs font-bold text-slate-500 uppercase tracking-wider">Date de début</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-800/50 px-4 py-3 text-sm text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
              />
            </div>
            <div className="mt-6 text-slate-500 font-light">→</div>
            <div className="flex-1">
              <label className="mb-2 block text-xs font-bold text-slate-500 uppercase tracking-wider">Date de fin</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-800/50 px-4 py-3 text-sm text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* SELECTEUR D'OFFRES */}
        {activeOffers.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {activeOffers.map((offer) => (
              <button
                key={offer.id}
                onClick={() => setSelectedOfferId(offer.id)}
                className={`whitespace-nowrap rounded-xl px-5 py-2.5 text-sm font-bold transition-all shadow-lg ${selectedOfferId === offer.id
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-purple-500/20'
                  : 'border border-white/10 bg-slate-900/50 text-slate-400 hover:bg-slate-800 hover:text-white backdrop-blur-sm'
                  }`}
              >
                {offer.name}
              </button>
            ))}
          </div>
        )}

        {selectedOffer ? (
          <>
            {/* KPI CARDS (Premium Glass) */}
            <div className="grid gap-6 md:grid-cols-4">
              <div className="rounded-3xl border border-white/5 bg-slate-900/40 p-6 backdrop-blur-md hover:bg-slate-800/50 transition-all hover:scale-[1.02] shadow-xl">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-2xl bg-blue-500/20 p-3 border border-blue-500/20">
                    <TrendingUp className="h-6 w-6 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">CA Généré</p>
                    <p className="text-2xl font-black text-white tracking-tight">{formatCurrency(stats.revenue)}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 font-medium bg-slate-800/50 rounded-lg px-2 py-1 inline-block border border-white/5">
                  {stats.dealsCount} deal(s) actif(s)
                </p>
              </div>

              <div className="rounded-3xl border border-white/5 bg-slate-900/40 p-6 backdrop-blur-md hover:bg-slate-800/50 transition-all hover:scale-[1.02] shadow-xl">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-2xl bg-emerald-500/20 p-3 border border-emerald-500/20">
                    <DollarSign className="h-6 w-6 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ma Commission</p>
                    <p className="text-2xl font-black text-white tracking-tight">{formatCurrency(stats.commission)}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 font-medium bg-slate-800/50 rounded-lg px-2 py-1 inline-block border border-white/5">
                  Taux: {selectedOffer.commission}
                </p>
              </div>

              <div className="rounded-3xl border border-white/5 bg-slate-900/40 p-6 backdrop-blur-md hover:bg-slate-800/50 transition-all hover:scale-[1.02] shadow-xl">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-2xl bg-purple-500/20 p-3 border border-purple-500/20">
                    <CreditCard className="h-6 w-6 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Commission Moy.</p>
                    <p className="text-2xl font-black text-white tracking-tight">
                      {stats.dealsCount > 0
                        ? formatCurrency(stats.commission / stats.dealsCount)
                        : formatCurrency(0)}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 font-medium bg-slate-800/50 rounded-lg px-2 py-1 inline-block border border-white/5">
                  Par deal/mensualité
                </p>
              </div>

              <div className="rounded-3xl border border-white/5 bg-slate-900/40 p-6 backdrop-blur-md hover:bg-slate-800/50 transition-all hover:scale-[1.02] shadow-xl">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-2xl bg-amber-500/20 p-3 border border-amber-500/20">
                    <Clock className="h-6 w-6 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">En attente</p>
                    <p className="text-2xl font-black text-white tracking-tight">{formatCurrency(pendingStats.amount)}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 font-medium bg-slate-800/50 rounded-lg px-2 py-1 inline-block border border-white/5">
                  {pendingStats.count} facture(s)
                </p>
              </div>
            </div>

            {/* DÉTAILS DE FACTURE (Glass) */}
            <div className="rounded-3xl border border-white/5 bg-slate-900/40 p-8 backdrop-blur-md shadow-xl">
              <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-400" />
                Détails de la période
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">

                {/* COMPTANT */}
                <div className="relative p-6 rounded-2xl bg-slate-800/30 border border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                      <h4 className="font-bold text-slate-200">Paiement Comptant</h4>
                      <div className="relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setActiveTooltip(activeTooltip === 'cash' ? null : 'cash'); }}
                          className="rounded-full bg-slate-700 text-slate-400 p-1 hover:text-white transition-colors"
                        >
                          <Info className="h-4 w-4" />
                        </button>

                        {activeTooltip === 'cash' && (
                          <div className="absolute left-0 top-8 z-50 w-72 rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-2xl backdrop-blur-xl">
                            <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Liste des clients (Comptant)</h5>
                            {stats.cashDeals.length > 0 ? (
                              <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                {stats.cashDeals.map(deal => (
                                  <div key={deal.id} className="border-b border-white/5 pb-2 last:border-0">
                                    <p className="text-sm font-bold text-white">{deal.contact}</p>
                                    <p className="text-xs text-emerald-400 font-medium">{formatCurrency(deal.value || 0)}</p>
                                    <p className="text-[10px] text-slate-500">
                                      Acheté le : {new Date(deal.lastContact || deal.dateAdded || "").toLocaleDateString('fr-FR')}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500 italic">Aucun paiement comptant sur cette période.</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-2xl font-bold text-white">{stats.cashDeals.length}</span>
                  </div>
                  <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                      style={{ width: stats.dealsCount > 0 ? `${(stats.cashDeals.length / stats.dealsCount) * 100}%` : '0%' }}
                    ></div>
                  </div>
                  <p className="text-xs text-slate-500 mt-3 text-right font-medium">
                    Total : <span className="text-emerald-400">{formatCurrency(stats.cashDeals.reduce((sum, d) => sum + (d.value || 0), 0))}</span>
                  </p>
                </div>

                {/* PLUSIEURS FOIS */}
                <div className="relative p-6 rounded-2xl bg-slate-800/30 border border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                      <h4 className="font-bold text-slate-200">Paiement en plusieurs fois</h4>
                      <div className="relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setActiveTooltip(activeTooltip === 'installments' ? null : 'installments'); }}
                          className="rounded-full bg-slate-700 text-slate-400 p-1 hover:text-white transition-colors"
                        >
                          <Info className="h-4 w-4" />
                        </button>

                        {activeTooltip === 'installments' && (
                          <div className="absolute right-0 top-8 z-50 w-80 rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-2xl backdrop-blur-xl">
                            <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Liste des clients (Échelonné)</h5>
                            {stats.installmentDeals.length > 0 ? (
                              <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                {stats.installmentDeals.map(deal => (
                                  <div key={deal.id} className="border-b border-white/5 pb-2 last:border-0">
                                    <div className="flex justify-between items-start">
                                      <p className="text-sm font-bold text-white">{deal.contact}</p>
                                      <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20 font-bold">
                                        {deal.installments}x
                                      </span>
                                    </div>
                                    <p className="text-xs text-blue-400 font-medium">Contrat total: {formatCurrency(deal.value || 0)}</p>
                                    <div className="flex justify-between mt-1">
                                      <p className="text-[10px] text-slate-500">
                                        Début : {new Date(deal.lastContact || deal.dateAdded || "").toLocaleDateString('fr-FR')}
                                      </p>
                                      <p className="text-[10px] text-slate-400">
                                        Fin : {getInstallmentEndDate(deal.lastContact || deal.dateAdded || "", deal.installments || 1)}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500 italic">Aucun paiement échelonné actif sur cette période.</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-2xl font-bold text-white">{stats.installmentDeals.length}</span>
                  </div>
                  <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(59,130,246,0.4)]"
                      style={{ width: stats.dealsCount > 0 ? `${(stats.installmentDeals.length / stats.dealsCount) * 100}%` : '0%' }}
                    ></div>
                  </div>
                  <p className="text-xs text-slate-500 mt-3 text-right font-medium">
                    Part mensuelle : <span className="text-blue-400">{formatCurrency(stats.revenue - stats.cashDeals.reduce((sum, d) => sum + (d.value || 0), 0))}</span>
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="mb-8 rounded-3xl border-2 border-dashed border-slate-800 bg-slate-900/20 p-12 text-center">
            <FileText className="mx-auto mb-4 h-12 w-12 text-slate-700" />
            <p className="text-lg font-bold text-white">Aucune offre active</p>
            <p className="mt-2 text-sm text-slate-500">
              Créez une offre active pour commencer à générer des factures
            </p>
          </div>
        )}

        {selectedOffer && stats.dealsCount > 0 && (
          <div className="flex justify-center mb-12">
            <button
              onClick={() => setIsGeneratorOpen(true)}
              className="group flex items-center gap-3 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 px-10 py-5 text-lg font-bold text-white shadow-xl shadow-purple-500/30 transition-all hover:scale-105 hover:shadow-purple-500/50 active:scale-95"
            >
              <FileText className="h-6 w-6" />
              Générer Facture
            </button>
          </div>
        )}

        <div className="mt-12">
          <h2 className="mb-6 text-2xl font-bold text-white flex items-center gap-3">
            <span className="w-2 h-8 rounded-full bg-purple-500"></span>
            Historique des factures
          </h2>

          <div className="overflow-hidden rounded-3xl border border-white/5 bg-slate-900/40 backdrop-blur-md shadow-2xl flex flex-col">
            <div className="overflow-y-auto max-h-[400px] custom-scrollbar">
              <table className="w-full text-left text-sm text-slate-300 relative border-collapse">
                <thead className="bg-slate-900/80 backdrop-blur text-xs uppercase text-slate-500 sticky top-0 z-10 border-b border-white/5">
                  <tr>
                    <th className="px-6 py-5 font-bold tracking-wider">N° Facture</th>
                    <th className="px-6 py-5 font-bold tracking-wider">Date</th>
                    <th className="px-6 py-5 font-bold tracking-wider">Client / Offre</th>
                    <th className="px-6 py-5 font-bold tracking-wider">Montant TTC</th>
                    <th className="px-6 py-5 font-bold tracking-wider">Statut</th>
                    <th className="px-6 py-5 text-right font-bold tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {savedInvoices.map((inv) => (
                    <tr
                      key={inv.id}
                      onClick={() => { setSelectedInvoice(inv); setIsDetailOpen(true); }}
                      className="transition-colors hover:bg-white/5 cursor-pointer group"
                    >
                      <td className="px-6 py-5 font-mono font-medium text-purple-400 group-hover:text-purple-300 transition-colors">{inv.invoice_number}</td>
                      <td className="px-6 py-5">{new Date(inv.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-5">
                        <div className="font-bold text-white">{inv.client_name}</div>
                        <div className="text-xs text-slate-500">{inv.offer_name}</div>
                      </td>
                      <td className="px-6 py-5 font-bold text-white">{formatCurrency(inv.amount_ttc)}</td>
                      <td className="px-6 py-5">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${getStatusColor(inv.status)}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right" onClick={(e) => e.stopPropagation()}>
                        {inv.pdf_url && (
                          <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a
                              href={inv.pdf_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-purple-400 transition-colors"
                              title="Voir"
                            >
                              <Eye className="h-5 w-5" />
                            </a>
                            <a
                              href={inv.pdf_url}
                              download
                              className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-emerald-400 transition-colors"
                              title="Télécharger"
                            >
                              <Download className="h-5 w-5" />
                            </a>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {savedInvoices.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center text-slate-500 italic">
                        Aucune facture enregistrée dans l'historique.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

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

        <PaymentMethodsModal
          isOpen={isPaymentMethodsOpen}
          onClose={() => setIsPaymentMethodsOpen(false)}
        />

        <IssuerProfilesModal
          isOpen={isIssuerProfilesOpen}
          onClose={() => setIsIssuerProfilesOpen(false)}
        />

        <StripeConnectModal
          isOpen={isStripeConnectOpen}
          onClose={() => setIsStripeConnectOpen(false)}
        />

        <InvoiceDetailModal
          invoice={selectedInvoice}
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          onUpdate={fetchInvoices}
        />

        <AutoInvoiceConfigModal
          isOpen={isAutoInvoiceOpen}
          onClose={() => setIsAutoInvoiceOpen(false)}
          offers={offers}
        />
      </div>
    </div>
  )
}