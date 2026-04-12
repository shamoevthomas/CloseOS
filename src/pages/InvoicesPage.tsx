import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CreditCard, TrendingUp, DollarSign, Calendar, FileText, Wallet, Building2, Eye, Download, Info, Clock, Zap, Lock } from 'lucide-react'
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
import { useUpgrade } from '../contexts/UpgradeContext'
import { useLanguage } from '../contexts/LanguageContext'
import { invoicesTranslations } from '../i18n/translations'

export function InvoicesPage() {
  const { prospects } = useProspects()
  const { offers } = useOffers()
  const { user, isFounder, isInTrial, isAdmin } = useAuth()
  const { showUpgrade } = useUpgrade()
  const { lang } = useLanguage()
  const t = invoicesTranslations[lang]
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
  const canUseAutoInvoice = isFounder || isInTrial || isAdmin

  const [searchParams] = useSearchParams()

  const [savedInvoices, setSavedInvoices] = useState<any[]>([])

  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const formatLocalDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const [startDate, setStartDate] = useState(formatLocalDate(firstDayOfMonth))
  const [endDate, setEndDate] = useState(formatLocalDate(lastDayOfMonth))
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
    const { data } = await supabase
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

      const prospectOfferBaseName = prospect.offer?.split(' - ')[0]

      const isCorrectOffer = prospect.offer_id === selectedOffer.id ||
        String(prospect.offer_id) === String(selectedOffer.id) ||
        prospect.offer === selectedOffer.name ||
        prospectOfferBaseName === selectedOffer.name ||
        prospect.title?.includes(selectedOffer.name)

      if (!isCorrectOffer) return false

      const dealDate = new Date(prospect.lastContact || prospect.last_contact || prospect.dateAdded || prospect.created_at || "")

      if (isNaN(dealDate.getTime())) return false

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
        const dealDate = new Date(prospect.lastContact || prospect.last_contact || prospect.dateAdded || prospect.created_at || "")

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
        const dealDate = new Date(deal.lastContact || deal.last_contact || deal.dateAdded || deal.created_at || "")
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
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  const getInstallmentEndDate = (startDateStr: string | Date, months: number) => {
    if (!startDateStr) return 'N/A'
    const d = new Date(startDateStr)
    d.setMonth(d.getMonth() + (months - 1))
    return d.toLocaleDateString(locale)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'payé': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'envoyée': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'générée': return 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20';
      case 'retard': return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      case 'en attente': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'en_attente': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20'; // Correction doublon
      default: return 'bg-white/5 text-white/40 border border-white/10';
    }
  };

  return (
    <div className="relative min-h-screen bg-[#111111] p-8 overflow-hidden font-sans text-white/80" onClick={() => setActiveTooltip(null)}>

      {/* Ambient Glows */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl space-y-8 z-10">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tighter">{lang === 'fr' ? 'Factures & Commissions' : 'Invoices & Commissions'}</h1>
            <p className="mt-1 text-white/40 text-sm font-medium">{lang === 'fr' ? 'Générez vos factures et suivez vos commissions' : 'Generate your invoices and track your commissions'}</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => canUseAutoInvoice ? setIsAutoInvoiceOpen(true) : showUpgrade()}
              className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white transition-all active:scale-95 ${canUseAutoInvoice ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:shadow-lg hover:shadow-amber-500/20' : 'bg-white/10 opacity-70 hover:opacity-90'}`}
            >
              <Zap className="h-4 w-4" />
              {t.auto_invoicing}
              {!canUseAutoInvoice && <Lock className="h-3.5 w-3.5 ml-1" />}
            </button>
            <button
              onClick={() => setIsStripeConnectOpen(true)}
              className="flex items-center gap-2 rounded-full bg-[#635BFF] px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-[#5349E0] hover:shadow-lg hover:shadow-[#635BFF]/20 active:scale-95"
            >
              <CreditCard className="h-4 w-4" />
              {t.stripe_connect}
            </button>

            <button
              onClick={() => setIsIssuerProfilesOpen(true)}
              className="flex items-center gap-2 rounded-full bg-white/[0.03] border border-white/[0.08] px-5 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/10 transition-all backdrop-blur-sm"
            >
              <Building2 className="h-4 w-4" />
              {t.issuer_profiles}
            </button>
            <button
              onClick={() => setIsPaymentMethodsOpen(true)}
              className="flex items-center gap-2 rounded-full bg-white/[0.03] border border-white/[0.08] px-5 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/10 transition-all backdrop-blur-sm"
            >
              <Wallet className="h-4 w-4" />
              {t.payment_methods}
            </button>
          </div>
        </div>

        {/* DATE PICKER (Glass) */}
        <div className="flex flex-col md:flex-row items-center gap-6 rounded-2xl border-[0.5px] border-white/[0.08] bg-white/[0.03] p-8 backdrop-blur-[16px] shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-500/5">
              <Calendar className="h-5 w-5 text-purple-400" />
            </div>
            <span className="font-bold text-white">{lang === 'fr' ? 'Période :' : 'Period:'}</span>
          </div>
          <div className="flex items-center gap-4 flex-1">
            <div className="flex-1">
              <label className="mb-2 block text-xs font-bold text-white/40 uppercase tracking-widest">{lang === 'fr' ? 'Date de début' : 'Start date'}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none transition-all"
              />
            </div>
            <div className="mt-6 text-white/40 font-light">→</div>
            <div className="flex-1">
              <label className="mb-2 block text-xs font-bold text-white/40 uppercase tracking-widest">{lang === 'fr' ? 'Date de fin' : 'End date'}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none transition-all"
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
                className={`whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-bold transition-all ${selectedOfferId === offer.id
                  ? 'bg-emerald-500 text-black'
                  : 'bg-white/[0.03] border border-white/[0.08] text-white/80 hover:bg-white/10'
                  }`}
              >
                {offer.name}
              </button>
            ))}
          </div>
        )}

        {selectedOffer ? (
          <>
            {/* KPI CARDS (Liquid Stone & Glass) */}
            <div className="grid gap-8 md:grid-cols-4">
              {/* CA Genere */}
              <div className="rounded-2xl border-[0.5px] border-white/[0.08] bg-white/[0.03] backdrop-blur-[16px] p-8 hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-300 shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
                <div className="flex items-start justify-between mb-6">
                  <div className="p-3 rounded-xl bg-blue-500/5">
                    <TrendingUp className="h-5 w-5 text-blue-400" />
                  </div>
                  <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">{stats.dealsCount} deal(s)</span>
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-2">{lang === 'fr' ? 'CA Généré' : 'Revenue Generated'}</p>
                <p className="text-3xl font-extrabold tracking-tight text-white">{formatCurrency(stats.revenue)}</p>
              </div>

              {/* Ma Commission */}
              <div className="rounded-2xl border-[0.5px] border-white/[0.08] bg-white/[0.03] backdrop-blur-[16px] p-8 hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-300 shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
                <div className="flex items-start justify-between mb-6">
                  <div className="p-3 rounded-xl bg-emerald-500/5">
                    <DollarSign className="h-5 w-5 text-emerald-400" />
                  </div>
                  <span className="text-xs font-medium text-white/40">{selectedOffer.commission}</span>
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-2">{lang === 'fr' ? 'Ma Commission' : 'My Commission'}</p>
                <p className="text-3xl font-extrabold tracking-tight text-white">{formatCurrency(stats.commission)}</p>
              </div>

              {/* Commission Moy. */}
              <div className="rounded-2xl border-[0.5px] border-white/[0.08] bg-white/[0.03] backdrop-blur-[16px] p-8 hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-300 shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
                <div className="flex items-start justify-between mb-6">
                  <div className="p-3 rounded-xl bg-purple-500/5">
                    <CreditCard className="h-5 w-5 text-purple-400" />
                  </div>
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-2">{lang === 'fr' ? 'Commission Moy.' : 'Avg. Commission'}</p>
                <p className="text-3xl font-extrabold tracking-tight text-white">
                  {stats.dealsCount > 0
                    ? formatCurrency(stats.commission / stats.dealsCount)
                    : formatCurrency(0)}
                </p>
              </div>

              {/* En attente — highlighted amber */}
              <div className="rounded-2xl border-[0.5px] border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-transparent backdrop-blur-[16px] p-8 hover:bg-white/[0.04] hover:border-amber-500/30 transition-all duration-300 shadow-[0_0_25px_rgba(245,158,11,0.15)]">
                <div className="flex items-start justify-between mb-6">
                  <div className="p-3 rounded-xl bg-amber-500/5">
                    <Clock className="h-5 w-5 text-amber-400" />
                  </div>
                  <span className="text-xs font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">{pendingStats.count} {lang === 'fr' ? 'facture(s)' : 'invoice(s)'}</span>
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-2">{t.total_pending}</p>
                <p className="text-3xl font-extrabold tracking-tight text-white">{formatCurrency(pendingStats.amount)}</p>
              </div>
            </div>

            {/* DETAILS DE FACTURE (Glass Card with Header Bar) */}
            <div className="rounded-2xl border-[0.5px] border-white/[0.08] bg-white/[0.03] backdrop-blur-[16px] overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
              <div className="bg-white/5 px-8 py-4 border-b border-white/5">
                <h4 className="text-sm font-bold uppercase tracking-wider text-white/60 flex items-center gap-2">
                  <Info className="h-4 w-4 text-emerald-400" />
                  {lang === 'fr' ? 'Détails de la période' : 'Period details'}
                </h4>
              </div>
              <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                {/* COMPTANT */}
                <div className="relative p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                      <h4 className="font-bold text-white/80">{lang === 'fr' ? 'Paiement Comptant' : 'Cash Payment'}</h4>
                      <div className="relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setActiveTooltip(activeTooltip === 'cash' ? null : 'cash'); }}
                          className="rounded-full bg-white/5 text-white/40 p-1 hover:text-white transition-colors"
                        >
                          <Info className="h-4 w-4" />
                        </button>

                        {activeTooltip === 'cash' && (
                          <div className="absolute left-0 top-8 z-50 w-72 rounded-2xl border border-white/[0.08] bg-[#1a1a1a] p-4 shadow-2xl backdrop-blur-xl">
                            <h5 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">{lang === 'fr' ? 'Liste des clients (Comptant)' : 'Client list (Cash)'}</h5>
                            {stats.cashDeals.length > 0 ? (
                              <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                {stats.cashDeals.map(deal => (
                                  <div key={deal.id} className="border-b border-white/5 pb-2 last:border-0">
                                    <p className="text-sm font-bold text-white">{deal.contact}</p>
                                    <p className="text-xs text-emerald-400 font-medium">{formatCurrency(deal.value || 0)}</p>
                                    <p className="text-[10px] text-white/40">
                                      {lang === 'fr' ? 'Acheté le' : 'Purchased on'} : {new Date(deal.lastContact || deal.last_contact || deal.dateAdded || deal.created_at || "").toLocaleDateString(locale)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-white/40 italic">{lang === 'fr' ? 'Aucun paiement comptant sur cette période.' : 'No cash payments in this period.'}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-2xl font-bold text-white">{stats.cashDeals.length}</span>
                  </div>
                  <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/[0.08]">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                      style={{ width: stats.dealsCount > 0 ? `${(stats.cashDeals.length / stats.dealsCount) * 100}%` : '0%' }}
                    ></div>
                  </div>
                  <p className="text-xs text-white/40 mt-3 text-right font-medium">
                    {lang === 'fr' ? 'Total' : 'Total'} : <span className="text-emerald-400">{formatCurrency(stats.cashDeals.reduce((sum, d) => sum + (d.value || 0), 0))}</span>
                  </p>
                </div>

                {/* PLUSIEURS FOIS */}
                <div className="relative p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                      <h4 className="font-bold text-white/80">{lang === 'fr' ? 'Paiement en plusieurs fois' : 'Installment Payment'}</h4>
                      <div className="relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setActiveTooltip(activeTooltip === 'installments' ? null : 'installments'); }}
                          className="rounded-full bg-white/5 text-white/40 p-1 hover:text-white transition-colors"
                        >
                          <Info className="h-4 w-4" />
                        </button>

                        {activeTooltip === 'installments' && (
                          <div className="absolute right-0 top-8 z-50 w-80 rounded-2xl border border-white/[0.08] bg-[#1a1a1a] p-4 shadow-2xl backdrop-blur-xl">
                            <h5 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">{lang === 'fr' ? 'Liste des clients (Échelonné)' : 'Client list (Installments)'}</h5>
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
                                    <p className="text-xs text-blue-400 font-medium">{lang === 'fr' ? 'Contrat total' : 'Total contract'}: {formatCurrency(deal.value || 0)}</p>
                                    <div className="flex justify-between mt-1">
                                      <p className="text-[10px] text-white/40">
                                        {lang === 'fr' ? 'Début' : 'Start'} : {new Date(deal.lastContact || deal.last_contact || deal.dateAdded || deal.created_at || "").toLocaleDateString(locale)}
                                      </p>
                                      <p className="text-[10px] text-white/40">
                                        {lang === 'fr' ? 'Fin' : 'End'} : {getInstallmentEndDate(deal.lastContact || deal.last_contact || deal.dateAdded || deal.created_at || "", deal.installments || 1)}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-white/40 italic">{lang === 'fr' ? 'Aucun paiement échelonné actif sur cette période.' : 'No active installment payments in this period.'}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-2xl font-bold text-white">{stats.installmentDeals.length}</span>
                  </div>
                  <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/[0.08]">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(59,130,246,0.4)]"
                      style={{ width: stats.dealsCount > 0 ? `${(stats.installmentDeals.length / stats.dealsCount) * 100}%` : '0%' }}
                    ></div>
                  </div>
                  <p className="text-xs text-white/40 mt-3 text-right font-medium">
                    {lang === 'fr' ? 'Part mensuelle' : 'Monthly share'} : <span className="text-blue-400">{formatCurrency(stats.revenue - stats.cashDeals.reduce((sum, d) => sum + (d.value || 0), 0))}</span>
                  </p>
                </div>
              </div>
              </div>
            </div>
          </>
        ) : (
          <div className="mb-8 rounded-2xl border-2 border-dashed border-white/[0.08] bg-white/[0.02] p-12 text-center">
            <FileText className="mx-auto mb-4 h-12 w-12 text-white/10" />
            <p className="text-lg font-bold text-white">{lang === 'fr' ? 'Aucune offre active' : 'No active offer'}</p>
            <p className="mt-2 text-sm text-white/40">
              {lang === 'fr' ? 'Créez une offre active pour commencer à générer des factures' : 'Create an active offer to start generating invoices'}
            </p>
          </div>
        )}

        {selectedOffer && stats.dealsCount > 0 && (
          <div className="flex justify-center mb-12">
            <button
              onClick={() => setIsGeneratorOpen(true)}
              className="group flex items-center gap-3 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 px-10 py-5 text-lg font-bold text-white shadow-xl shadow-purple-500/30 transition-all hover:scale-105 hover:shadow-purple-500/50 active:scale-95"
            >
              <FileText className="h-6 w-6" />
              {lang === 'fr' ? 'Générer Facture' : 'Generate Invoice'}
            </button>
          </div>
        )}

        <div className="mt-12">
          <div className="rounded-2xl border-[0.5px] border-white/[0.08] bg-white/[0.03] backdrop-blur-[16px] overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.2)] flex flex-col">
            {/* Header bar */}
            <div className="bg-white/5 px-8 py-4 border-b border-white/5">
              <h4 className="text-sm font-bold uppercase tracking-wider text-white/60">{lang === 'fr' ? 'Historique des factures' : 'Invoice history'}</h4>
            </div>
            <div className="overflow-y-auto max-h-[400px] custom-scrollbar">
              <table className="w-full text-left text-sm text-white/60 relative border-collapse">
                <thead className="bg-white/[0.02] text-xs uppercase text-white/40 sticky top-0 z-10">
                  <tr>
                    <th className="px-8 py-4 font-bold tracking-widest">{lang === 'fr' ? 'N° Facture' : 'Invoice #'}</th>
                    <th className="px-8 py-4 font-bold tracking-widest">{t.date}</th>
                    <th className="px-8 py-4 font-bold tracking-widest">{lang === 'fr' ? 'Client / Offre' : 'Client / Offer'}</th>
                    <th className="px-8 py-4 font-bold tracking-widest">{lang === 'fr' ? 'Montant TTC' : 'Amount incl. tax'}</th>
                    <th className="px-8 py-4 font-bold tracking-widest">{t.status}</th>
                    <th className="px-8 py-4 text-right font-bold tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {savedInvoices.map((inv) => (
                    <tr
                      key={inv.id}
                      onClick={() => { setSelectedInvoice(inv); setIsDetailOpen(true); }}
                      className="transition-all duration-300 hover:bg-white/[0.04] cursor-pointer group"
                    >
                      <td className="px-8 py-5 font-mono font-medium text-emerald-400 group-hover:text-emerald-300 transition-colors">{inv.invoice_number}</td>
                      <td className="px-8 py-5">{new Date(inv.created_at).toLocaleDateString()}</td>
                      <td className="px-8 py-5">
                        <div className="font-bold text-white">{inv.client_name}</div>
                        <div className="text-xs text-white/40 mt-0.5">{inv.offer_name}</div>
                      </td>
                      <td className="px-8 py-5 font-bold text-white">{formatCurrency(inv.amount_ttc)}</td>
                      <td className="px-8 py-5">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${getStatusColor(inv.status)}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right" onClick={(e) => e.stopPropagation()}>
                        {inv.pdf_url && (
                          <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <a
                              href={inv.pdf_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 rounded-xl hover:bg-white/[0.04] text-white/40 hover:text-emerald-400 transition-all duration-300"
                              title={lang === 'fr' ? 'Voir' : 'View'}
                            >
                              <Eye className="h-5 w-5" />
                            </a>
                            <a
                              href={inv.pdf_url}
                              download
                              className="p-2 rounded-xl hover:bg-white/[0.04] text-white/40 hover:text-emerald-400 transition-all duration-300"
                              title={lang === 'fr' ? 'Télécharger' : 'Download'}
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
                      <td colSpan={6} className="px-8 py-16 text-center text-white/40 italic">
                        {lang === 'fr' ? "Aucune facture enregistrée dans l'historique." : 'No invoices recorded in history.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
  )
}