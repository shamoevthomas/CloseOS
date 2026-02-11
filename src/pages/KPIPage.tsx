import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  DollarSign,
  ShoppingCart,
  Target,
  Award,
  TrendingUp,
  Ban,
  Users,
  Briefcase,
  Calendar,
  Infinity,
  UserX,
  Archive,
  CheckSquare
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { useOffers } from '../contexts/OffersContext';
import { useProspects } from '../contexts/ProspectsContext';

// ============================================================================
// HELPERS (Logique reprise de EXKPIPage pour la fiabilité)
// ============================================================================

const extractDealsFromKanban = (data: any): any[] => {
  if (!data) return [];
  if (Array.isArray(data)) return data;

  const allDeals: any[] = [];
  const recursiveExtract = (obj: any) => {
    if (!obj || typeof obj !== 'object') return;
    if (obj.columns && typeof obj.columns === 'object') {
      recursiveExtract(obj.columns);
      return;
    }
    Object.entries(obj).forEach(([key, value]: [string, any]) => {
      const columnKey = key.toLowerCase();
      if (Array.isArray(value)) {
        value.forEach((item: any) => {
          if (!item || typeof item !== 'object') return;
          const deal = { ...item };
          if (columnKey.match(/gagn|won|sign|clos|fermé/)) deal.status = 'Gagné';
          else if (columnKey.match(/perdu|lost/)) deal.status = 'Perdu';
          else if (!deal.status) deal.status = 'In Progress';
          allDeals.push(deal);
        });
      } else if (value && typeof value === 'object') {
        const items = value.items || value.deals || value.data || [];
        if (Array.isArray(items) && items.length > 0) {
          items.forEach((item: any) => {
            const deal = { ...item };
            const statusKey = (value.title || value.name || key).toLowerCase();
            if (statusKey.match(/gagn|won|sign|clos|fermé/)) deal.status = 'Gagné';
            else if (statusKey.match(/perdu|lost/)) deal.status = 'Perdu';
            else if (!deal.status) deal.status = 'In Progress';
            allDeals.push(deal);
          });
        } else {
          recursiveExtract(value);
        }
      }
    });
  };
  recursiveExtract(data);
  return allDeals;
};

const getDealAmount = (deal: any): number => {
  const possibleFields = [deal.amount, deal.price, deal.prix, deal.montant, deal.value, deal.total];
  for (const value of possibleFields) {
    if (value !== undefined && value !== null && value !== '') {
      if (typeof value === 'number' && !isNaN(value)) return value > 0 ? value : 0;
      try {
        let str = String(value).replace(/[€$£A-Za-z]/g, '').replace(/\s+/g, '');
        str = /,\d{1,2}$/.test(str) ? str.replace(',', '.') : str.replace(/,/g, '');
        const num = parseFloat(str);
        if (!isNaN(num) && num > 0) return num;
      } catch (e) {}
    }
  }
  return 0;
};

const isWonDeal = (deal: any): boolean => {
  const s = String(deal.status || deal.statut || deal.stage || '').toLowerCase();
  return s.match(/gagn|won|sign|closed|clos/) !== null;
};

const isLostDeal = (deal: any): boolean => {
  const s = String(deal.status || deal.statut || deal.stage || '').toLowerCase();
  return s.match(/perdu|lost/) !== null;
};

const getDealDate = (deal: any): Date => {
  const possibleFields = [deal.createdAt, deal.date, deal.creationDate, deal.dateCreation, deal.created_at, deal.dateAdded];
  for (const value of possibleFields) {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return new Date();
};

const getDealOffer = (deal: any): string => {
  return String(deal.offer || deal.offerName || deal.offre || deal.offer_name || '').toLowerCase();
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function KPIPage() {
  const { offers: allOffers } = useOffers();
  const { prospects: allProspects } = useProspects();

  // --- Logique Offres ---
  const isExpired = (offer: any) => {
    if (!offer.endDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(offer.endDate);
    return end < today;
  };

  const activeOffers = useMemo(() => allOffers.filter(o => o.status === 'active' && !isExpired(o)), [allOffers]);
  const inactiveOffers = useMemo(() => allOffers.filter(o => o.status === 'inactive' || (o.status === 'active' && isExpired(o))), [allOffers]);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'all'>('all'); 
  const [activeTab, setActiveTab] = useState('global');
  const [legacyDeals, setLegacyDeals] = useState<any[]>([]);
  const [includeInactiveInGlobal, setIncludeInactiveInGlobal] = useState(false);

  // Chargement Legacy
  useEffect(() => {
    const loadData = () => {
      try {
        const pipelineData = localStorage.getItem('closeros_pipeline');
        if (pipelineData) {
          setLegacyDeals(extractDealsFromKanban(JSON.parse(pipelineData)));
        }
      } catch (error) {
        console.error('Error loading legacy data', error);
      }
    };
    loadData();
  }, []);

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

  const formatCurrency = (value: number) => new Intl.NumberFormat('fr-FR', { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
  const formatPercent = (value: number) => value.toFixed(1);

  // Helper de filtrage (Offre Active)
  const isActiveOffer = (itemName: string | undefined, itemId: string | number | undefined) => {
    if (itemId) {
      if (activeOffers.some(o => String(o.id) === String(itemId))) return true;
    }
    if (itemName) {
      const nameLower = itemName.toLowerCase().trim();
      return activeOffers.some(o => {
        const oName = o.name.toLowerCase().trim();
        return nameLower.includes(oName) || oName.includes(nameLower);
      });
    }
    return false;
  };

  const parseCommission = (str?: string) => {
    if (!str) return 0.10;
    const match = str.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) / 100 : 0.10;
  };

  // ==================================================================================
  // 1. CALCULS BASÉS SUR LES PROSPECTS (Supabase/Context) - Logique EXKPIPage
  // ==================================================================================
  
  // A. Filtrage Context pour les KPI (Respecte ViewMode)
  const filteredProspects = allProspects.filter((prospect) => {
    if (activeTab !== 'global') {
      const tabName = activeTab.toLowerCase();
      const pOffer = (prospect.offer || '').toLowerCase();
      const pOfferId = String(prospect.offerId || '');
      const targetOffer = allOffers.find(o => o.name.toLowerCase() === tabName);
      
      const matchName = pOffer.includes(tabName) || tabName.includes(pOffer);
      const matchId = targetOffer && pOfferId === String(targetOffer.id);
      if (!matchName && !matchId) return false;
    } else if (!includeInactiveInGlobal) {
      if (!isActiveOffer(prospect.offer, prospect.offerId)) return false;
    }

    if (viewMode === 'month') {
      const pDate = prospect.dateAdded ? new Date(prospect.dateAdded) : new Date();
      if (pDate.getMonth() !== currentDate.getMonth() || pDate.getFullYear() !== currentDate.getFullYear()) return false;
    }
    return true;
  });

  // B. Filtrage Context pour les Graphiques (Ignore ViewMode, prend tout l'historique)
  const historicalProspects = allProspects.filter((prospect) => {
    if (activeTab !== 'global') {
      const tabName = activeTab.toLowerCase();
      const pOffer = (prospect.offer || '').toLowerCase();
      const pOfferId = String(prospect.offerId || '');
      const targetOffer = allOffers.find(o => o.name.toLowerCase() === tabName);
      
      const matchName = pOffer.includes(tabName) || tabName.includes(pOffer);
      const matchId = targetOffer && pOfferId === String(targetOffer.id);
      if (!matchName && !matchId) return false;
    } else if (!includeInactiveInGlobal) {
      if (!isActiveOffer(prospect.offer, prospect.offerId)) return false;
    }
    return true;
  });

  // KPI Context
  const wonProspects = filteredProspects.filter(p => p?.stage === 'won');
  const lostProspects = filteredProspects.filter(p => p?.stage === 'lost');
  const activeProspects = filteredProspects.filter(p => p?.stage && p.stage !== 'won' && p.stage !== 'lost');
  
  const ctxRevenue = wonProspects.reduce((sum, p) => sum + (p?.value || 0), 0);
  const ctxSales = wonProspects.length;
  const ctxLeads = filteredProspects.length;
  const ctxClosed = wonProspects.length + lostProspects.length;
  const ctxConversion = ctxClosed > 0 ? (ctxSales / ctxClosed) * 100 : 0;
  
  // Commissions Context
  const ctxCommissions = wonProspects.reduce((sum, deal) => {
    const dealOffer = allOffers.find(o => (deal.offerId && String(o.id) === String(deal.offerId)) || (deal.offer && o.name.toLowerCase() === deal.offer.toLowerCase()));
    const rate = dealOffer?.commission ? parseCommission(dealOffer.commission) : 0.10;
    return sum + (deal.value * rate);
  }, 0);

  // No Show Context
  const noShowProspects = filteredProspects.filter(p => (p?.status || p?.stage || '').toLowerCase().match(/no show|absent|noshow/));
  const ctxOutcomes = wonProspects.length + lostProspects.length + noShowProspects.length + filteredProspects.filter(p => (p.stage || '').match(/follow/)).length;
  const ctxNoShowRate = ctxOutcomes > 0 ? (noShowProspects.length / ctxOutcomes) * 100 : 0;


  // ==================================================================================
  // 2. CALCULS BASÉS SUR LE LEGACY (LocalStorage) - Logique EXKPIPage
  // ==================================================================================
  
  // A. Filtrage Legacy pour KPI
  const filteredLegacyDeals = legacyDeals.filter((deal) => {
    if (activeTab !== 'global') {
      const dealOffer = getDealOffer(deal);
      const tabName = activeTab.toLowerCase();
      if (!dealOffer.includes(tabName) && !tabName.includes(dealOffer)) return false;
    } else if (!includeInactiveInGlobal) {
      const dealOfferName = getDealOffer(deal);
      const isLinkedToActive = activeOffers.some(o => {
        const oName = o.name.toLowerCase().trim();
        return dealOfferName.includes(oName) || oName.includes(dealOfferName);
      });
      if (!isLinkedToActive) return false;
    }

    if (viewMode === 'month') {
      const dDate = getDealDate(deal);
      if (dDate.getMonth() !== currentDate.getMonth() || dDate.getFullYear() !== currentDate.getFullYear()) return false;
    }
    return true;
  });

  // B. Filtrage Legacy pour Graphiques (Historique complet)
  const historicalLegacyDeals = legacyDeals.filter((deal) => {
    if (activeTab !== 'global') {
      const dealOffer = getDealOffer(deal);
      const tabName = activeTab.toLowerCase();
      if (!dealOffer.includes(tabName) && !tabName.includes(dealOffer)) return false;
    } else if (!includeInactiveInGlobal) {
      const dealOfferName = getDealOffer(deal);
      const isLinkedToActive = activeOffers.some(o => {
        const oName = o.name.toLowerCase().trim();
        return dealOfferName.includes(oName) || oName.includes(dealOfferName);
      });
      if (!isLinkedToActive) return false;
    }
    return true;
  });

  const legacyWon = filteredLegacyDeals.filter(d => isWonDeal(d));
  const legacyLost = filteredLegacyDeals.filter(d => isLostDeal(d));
  const legacyRev = legacyWon.reduce((s, d) => s + getDealAmount(d), 0);
  const legacyConv = (filteredLegacyDeals.length > 0) ? (legacyWon.length / filteredLegacyDeals.length) * 100 : 0; // Approx pour legacy
  
  // ==================================================================================
  // 3. SELECTION FINALE (Source of Truth)
  // ==================================================================================

  const hasContextData = allProspects.length > 0;

  // Variables affichées dans les cartes (KPI)
  const finalRevenue = hasContextData ? ctxRevenue : legacyRev;
  const finalSales = hasContextData ? ctxSales : legacyWon.length;
  const finalLeads = hasContextData ? ctxLeads : filteredLegacyDeals.length;
  const finalConversion = hasContextData ? ctxConversion : legacyConv;
  const finalCommissions = hasContextData ? ctxCommissions : legacyRev * 0.10;
  const finalNoShowRate = hasContextData ? ctxNoShowRate : 0;
  const finalLost = hasContextData ? lostProspects.length : legacyLost.length;
  const finalActiveCount = hasContextData ? activeProspects.length : 0;
  const avgCommission = finalSales > 0 ? finalCommissions / finalSales : 0;


  // ==================================================================================
  // 4. CONSTRUCTION DES DONNÉES GRAPHIQUES (Recharts)
  // ==================================================================================
  
  const chartSourceData = hasContextData ? historicalProspects : historicalLegacyDeals;

  const chartData = useMemo(() => {
    const grouped: Record<string, { won: number; total: number; commission: number; date: Date }> = {};

    chartSourceData.forEach(item => {
      // Normalisation des champs selon la source
      const date = hasContextData 
        ? (item.dateAdded ? new Date(item.dateAdded) : new Date()) 
        : getDealDate(item);
      
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!grouped[key]) {
        grouped[key] = { won: 0, total: 0, commission: 0, date };
      }

      const isWon = hasContextData ? (item.stage === 'won') : isWonDeal(item);
      const isLost = hasContextData ? (item.stage === 'lost') : isLostDeal(item);

      if (isWon || isLost) {
        grouped[key].total += 1;
        if (isWon) {
          grouped[key].won += 1;
          const val = hasContextData ? (item.value || 0) : getDealAmount(item);
          let comm = 0;
          if (hasContextData) {
             const dealOffer = allOffers.find(o => (item.offerId && String(o.id) === String(item.offerId)) || (item.offer && o.name.toLowerCase() === (item.offer || '').toLowerCase()));
             const rate = dealOffer?.commission ? parseCommission(dealOffer.commission) : 0.10;
             comm = val * rate;
          } else {
             comm = val * 0.10;
          }
          grouped[key].commission += comm;
        }
      }
    });

    return Object.values(grouped)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(d => ({
        name: d.date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
        closingRate: d.total > 0 ? parseFloat(((d.won / d.total) * 100).toFixed(1)) : 0,
        commission: Math.round(d.commission)
      }));
  }, [chartSourceData, hasContextData, allOffers]);

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8 font-sans text-slate-100">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-slate-900/50 p-6 rounded-2xl border border-white/5 backdrop-blur-xl">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-600/20 rounded-lg border border-blue-500/30">
                <TrendingUp className="w-6 h-6 text-blue-400" />
              </div>
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">Performance</h1>
            </div>
            <p className="text-slate-400 text-sm">{viewMode === 'month' ? `Analyse pour ${currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}` : 'Analyse globale'}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {viewMode === 'month' && (
              <div className="flex items-center bg-slate-800/80 rounded-xl p-1 border border-white/10">
                <button onClick={prevMonth} className="p-2 hover:bg-slate-700/50 rounded-lg text-slate-300"><ChevronLeft className="w-4 h-4" /></button>
                <span className="px-4 text-sm font-semibold text-white capitalize min-w-[120px] text-center">{currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span>
                <button onClick={nextMonth} className="p-2 hover:bg-slate-700/50 rounded-lg text-slate-300"><ChevronRight className="w-4 h-4" /></button>
              </div>
            )}
            <button onClick={() => setViewMode(viewMode === 'month' ? 'all' : 'month')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-sm font-medium text-slate-300 hover:text-white transition-all">
              {viewMode === 'month' ? <Infinity className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
              {viewMode === 'month' ? 'Vue Globale' : 'Vue Mensuelle'}
            </button>
          </div>
        </div>

        {/* TABS BAR */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4 border-b border-white/5 pb-1">
          <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-2 scrollbar-hide">
            <button onClick={() => setActiveTab('global')} className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all border ${activeTab === 'global' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 border-blue-500/50 text-white shadow-lg' : 'bg-slate-800/30 border-transparent text-slate-400 hover:bg-slate-800'}`}>Global</button>
            {activeOffers.map((offer) => (
              <button key={offer.id} onClick={() => setActiveTab(offer.name)} className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all border whitespace-nowrap ${activeTab === offer.name ? 'bg-gradient-to-r from-emerald-600 to-teal-600 border-emerald-500/50 text-white shadow-lg' : 'bg-slate-800/30 border-transparent text-slate-400 hover:bg-slate-800'}`}>{offer.name}</button>
            ))}
            {inactiveOffers.length > 0 && (
              <div className="relative group">
                <select value={inactiveOffers.some(o => o.name === activeTab) ? activeTab : "archives"} onChange={(e) => setActiveTab(e.target.value)} className={`appearance-none pl-10 pr-8 py-2.5 rounded-xl text-sm font-bold border cursor-pointer outline-none ${inactiveOffers.some(o => o.name === activeTab) ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-800/30 border-transparent text-slate-500 hover:text-slate-300'}`}>
                  <option value="archives" disabled hidden>Archives ({inactiveOffers.length})</option>
                  {inactiveOffers.map(o => <option key={o.id} value={o.name} className="bg-slate-900">📦 {o.name}</option>)}
                </select>
                <Archive className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${inactiveOffers.some(o => o.name === activeTab) ? 'text-white' : 'text-slate-500'}`} />
              </div>
            )}
          </div>

          {activeTab === 'global' && (
            <button onClick={() => setIncludeInactiveInGlobal(!includeInactiveInGlobal)} className="flex items-center gap-2.5 px-4 py-2 rounded-lg hover:bg-white/5 transition-colors group">
              <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${includeInactiveInGlobal ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600 group-hover:border-slate-500'}`}>{includeInactiveInGlobal && <CheckSquare className="w-3.5 h-3.5 text-white" />}</div>
              <span className={`text-sm font-medium ${includeInactiveInGlobal ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'}`}>Inclure offres inactives</span>
            </button>
          )}
        </div>

        {/* CARDS KPI */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <KpiCard title="CA Généré" value={`${formatCurrency(finalRevenue)} €`} icon={DollarSign} color="emerald" trend="+12%" />
          <KpiCard title="Ventes Totales" value={finalSales.toString()} icon={ShoppingCart} color="blue" />
          <KpiCard title="Taux de Conversion" value={`${formatPercent(finalConversion)} %`} icon={Target} color="purple" />
          <KpiCard title="Mes Commissions" value={`${formatCurrency(finalCommissions)} €`} icon={Award} color="amber" glow />
          <KpiCard title="Taux de No Show" value={`${finalNoShowRate.toFixed(1)} %`} icon={UserX} color="rose" />
          <KpiCard title="Deals Perdus" value={finalLost.toString()} icon={Ban} color="slate" />
        </div>

        {/* GRAPHIQUES RECHARTS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="bg-slate-900/50 rounded-2xl p-6 border border-white/5 backdrop-blur-sm">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-400" />
              Historique Taux de Closing
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorClosing" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} unit="%" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                    itemStyle={{ color: '#a855f7' }}
                  />
                  <Area type="monotone" dataKey="closingRate" stroke="#a855f7" strokeWidth={3} fillOpacity={1} fill="url(#colorClosing)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-slate-900/50 rounded-2xl p-6 border border-white/5 backdrop-blur-sm">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-400" />
              Historique Commissions
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorCommissions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                    itemStyle={{ color: '#10b981' }}
                    formatter={(value: number) => [`${value} €`, 'Commission']}
                  />
                  <Area type="monotone" dataKey="commission" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorCommissions)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* SUMMARY */}
        <div className="bg-slate-900/50 rounded-2xl p-8 border border-white/5 backdrop-blur-sm">
          <h2 className="text-xl font-bold text-white mb-8 flex items-center gap-3"><Briefcase className="w-5 h-5 text-indigo-400" />Vue d'ensemble Pipeline</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <SummaryItem label="Total Leads Traités" value={finalLeads} icon={Users} color="indigo" />
            <SummaryItem label="Deals en Cours" value={finalActiveCount} icon={Briefcase} color="cyan" />
            <SummaryItem label="Commission Moy." value={`${formatCurrency(avgCommission)} €`} icon={Award} color="amber" />
          </div>
        </div>
      </div>
    </div>
  );
}

const KpiCard = ({ title, value, icon: Icon, color, glow }: any) => {
  const colors: any = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    slate: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  };
  return (
    <div className={`relative p-6 rounded-2xl bg-slate-800/40 border border-white/5 backdrop-blur-md transition-all hover:bg-slate-800/60 group ${glow ? 'shadow-lg shadow-amber-500/10 border-amber-500/30' : ''}`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${colors[color] || colors.slate} group-hover:scale-110 transition-transform duration-300`}><Icon className="w-6 h-6" /></div>
      </div>
      <h3 className="text-slate-400 text-sm font-medium mb-1">{title}</h3>
      <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
    </div>
  );
};

const SummaryItem = ({ label, value, icon: Icon, color }: any) => {
  const colors: any = { indigo: 'text-indigo-400 bg-indigo-500/10', cyan: 'text-cyan-400 bg-cyan-500/10', amber: 'text-amber-400 bg-amber-500/10' };
  return (
    <div className="flex items-center gap-5 p-4 rounded-xl hover:bg-white/5 transition-colors">
      <div className={`p-4 rounded-2xl ${colors[color]}`}><Icon className="w-8 h-8" /></div>
      <div><p className="text-slate-400 text-sm font-medium mb-1">{label}</p><p className="text-2xl font-bold text-white">{value}</p></div>
    </div>
  );
};