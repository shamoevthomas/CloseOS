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
  Filter,
  Archive,
  CheckSquare,
  Square
} from 'lucide-react';
import { useOffers } from '../contexts/OffersContext';
import { useProspects } from '../contexts/ProspectsContext';

// ============================================================================
// UNIVERSAL DATA PARSING HELPERS (OMNIVORE MODE + KANBAN SUPPORT)
// ============================================================================

const extractDealsFromKanban = (data: any): any[] => {
  if (!data) return [];
  if (Array.isArray(data)) return data;

  const allDeals: any[] = [];
  const recursiveExtract = (obj: any, parentKey: string = ''): void => {
    if (!obj || typeof obj !== 'object') return;
    if (obj.columns && typeof obj.columns === 'object') {
      recursiveExtract(obj.columns, 'columns');
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
          recursiveExtract(value, key);
        }
      }
    });
  };
  recursiveExtract(data);
  return allDeals;
};

const getDealAmount = (deal: any): number => {
  const possibleFields = [deal.amount, deal.price, deal.prix, deal.montant, deal.value, deal.total, deal.Amount, deal.Price];
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
  const s = String(deal.status || deal.statut || deal.state || '').toLowerCase();
  return s.match(/gagn|won|sign|closed|clos/) !== null;
};

const isLostDeal = (deal: any): boolean => {
  const s = String(deal.status || deal.statut || deal.state || '').toLowerCase();
  return s.match(/perdu|lost/) !== null;
};

const getDealDate = (deal: any): Date => {
  const possibleFields = [deal.createdAt, deal.date, deal.creationDate, deal.dateCreation, deal.created_at];
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

  // Séparation des offres
  const activeOffers = useMemo(() => allOffers.filter(o => o.status === 'active'), [allOffers]);
  const inactiveOffers = useMemo(() => allOffers.filter(o => o.status === 'inactive'), [allOffers]);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'all'>('all'); 
  const [activeTab, setActiveTab] = useState('global');
  const [deals, setDeals] = useState<any[]>([]);
  
  // 🚀 NOUVEAU : État pour inclure ou non les offres inactives dans le Global
  const [includeInactiveInGlobal, setIncludeInactiveInGlobal] = useState(false);

  useEffect(() => {
    const loadData = () => {
      try {
        const pipelineData = localStorage.getItem('closeros_pipeline');
        if (pipelineData) {
          const parsed = JSON.parse(pipelineData);
          setDeals(extractDealsFromKanban(parsed));
        } else {
          setDeals([]);
        }
      } catch (error) {
        console.error('❌ Error loading KPI data:', error);
        setDeals([]);
      }
    };
    loadData();
    window.addEventListener('focus', loadData);
    return () => window.removeEventListener('focus', loadData);
  }, []);

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

  const formatCurrency = (value: number) => new Intl.NumberFormat('fr-FR', { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
  const formatPercent = (value: number) => value.toFixed(1);

  // --- LOGIQUE DE FILTRAGE PRINCIPALE ---
  
  // Helper pour vérifier si un deal/prospect appartient à une offre active
  const isActiveOffer = (itemName: string | undefined, itemId: string | number | undefined) => {
    if (itemId) return activeOffers.some(o => String(o.id) === String(itemId));
    if (itemName) return activeOffers.some(o => o.name.toLowerCase() === itemName.toLowerCase());
    return false; // Si pas d'info, on considère inactif par sécurité ou on inclut par défaut selon la logique métier (ici strict)
  };

  // 1. Filtrage des Prospects (Context)
  const filteredProspects = allProspects.filter((prospect) => {
    // A. Filtre par Onglet (Offre)
    if (activeTab !== 'global') {
      const tabName = activeTab.toLowerCase();
      const pOffer = (prospect.offer || '').toLowerCase();
      const pOfferId = String(prospect.offerId || '');
      
      // Chercher l'offre sélectionnée
      const targetOffer = allOffers.find(o => o.name.toLowerCase() === tabName);
      
      const matchName = pOffer.includes(tabName) || tabName.includes(pOffer);
      const matchId = targetOffer && pOfferId === String(targetOffer.id);

      if (!matchName && !matchId) return false;
    } else {
      // B. Filtre Global : Gestion de la case à cocher "Inclure inactifs"
      if (!includeInactiveInGlobal) {
        // Si la case n'est PAS cochée, on ne garde que ce qui est lié à une offre ACTIVE
        if (!isActiveOffer(prospect.offer, prospect.offerId)) return false;
      }
    }

    // C. Filtre Date
    if (viewMode === 'month') {
      const pDate = prospect.dateAdded ? new Date(prospect.dateAdded) : new Date();
      if (pDate.getMonth() !== currentDate.getMonth() || pDate.getFullYear() !== currentDate.getFullYear()) return false;
    }
    return true;
  });

  // 2. Filtrage des Deals (Kanban/Legacy)
  const filteredDeals = deals.filter((deal) => {
    // A. Filtre par Onglet
    if (activeTab !== 'global') {
      const dealOffer = getDealOffer(deal);
      const tabName = activeTab.toLowerCase();
      if (!dealOffer.includes(tabName) && !tabName.includes(dealOffer)) return false;
    } else {
      // B. Filtre Global : Gestion Inactifs
      if (!includeInactiveInGlobal) {
        // On checke si le nom de l'offre du deal correspond à une offre active
        const dealOfferName = getDealOffer(deal);
        const isLinkedToActive = activeOffers.some(o => o.name.toLowerCase().includes(dealOfferName) || dealOfferName.includes(o.name.toLowerCase()));
        if (!isLinkedToActive) return false;
      }
    }

    // C. Filtre Date
    if (viewMode === 'month') {
      const dDate = getDealDate(deal);
      if (dDate.getMonth() !== currentDate.getMonth() || dDate.getFullYear() !== currentDate.getFullYear()) return false;
    }
    return true;
  });

  // --- CALCULS KPI ---
  const wonDeals = filteredProspects.filter(p => p?.stage === 'won');
  const lostDeals = filteredProspects.filter(p => p?.stage === 'lost');
  const followUpDeals = filteredProspects.filter(p => (p?.status || p?.stage || '').toLowerCase().match(/follow|relance/));
  const noShowDeals = filteredProspects.filter(p => (p?.status || p?.stage || '').toLowerCase().match(/no show|absent|noshow/));
  const activeDeals = filteredProspects.filter(p => p?.stage && p.stage !== 'won' && p.stage !== 'lost');

  const totalRevenue = wonDeals.reduce((sum, p) => sum + (p?.value || 0), 0);
  const totalSales = wonDeals.length;
  const totalLeads = filteredProspects.length;
  const closedDeals = wonDeals.length + lostDeals.length;
  const conversionRate = closedDeals > 0 ? (totalSales / closedDeals) * 100 : 0;
  
  const totalCallOutcomes = wonDeals.length + lostDeals.length + followUpDeals.length + noShowDeals.length;
  const noShowRate = totalCallOutcomes > 0 ? (noShowDeals.length / totalCallOutcomes) * 100 : 0;

  const parseCommission = (str?: string) => {
    if (!str) return 0.10;
    const match = str.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) / 100 : 0.10;
  };

  const totalCommissions = wonDeals.reduce((sum, deal) => {
    if (!deal?.value) return sum;
    const dealOffer = allOffers.find(o => (deal.offerId && String(o.id) === String(deal.offerId)) || (deal.offer && o.name.toLowerCase() === deal.offer.toLowerCase()));
    const rate = dealOffer?.commission ? parseCommission(dealOffer.commission) : 0.10;
    return sum + (deal.value * rate);
  }, 0);

  const avgCommission = totalSales > 0 ? totalCommissions / totalSales : 0;

  // Legacy fallback (si pas de prospects context)
  const legacyWon = filteredDeals.filter(d => isWonDeal(d));
  const legacyRev = legacyWon.reduce((s, d) => s + getDealAmount(d), 0);
  const hasContextData = allProspects.length > 0;
  const hasLegacyData = deals.length > 0;

  // Valeurs finales à afficher
  const finalRevenue = hasContextData ? totalRevenue : legacyRev;
  const finalSales = hasContextData ? totalSales : legacyWon.length;
  const finalLeads = hasContextData ? totalLeads : filteredDeals.length;
  const finalConversion = hasContextData ? conversionRate : (hasLegacyData && filteredDeals.length > 0 ? (legacyWon.length / filteredDeals.length) * 100 : 0);
  const finalCommissions = hasContextData ? totalCommissions : legacyRev * 0.10;
  const finalNoShowRate = hasContextData ? noShowRate : 0;
  const finalLost = hasContextData ? lostDeals.length : filteredDeals.filter(d => isLostDeal(d)).length;
  const finalAvgComm = hasContextData ? avgCommission : (legacyWon.length > 0 ? (legacyRev * 0.10) / legacyWon.length : 0);
  const finalActiveCount = hasContextData ? activeDeals.length : 0;

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8 font-sans text-slate-100">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER MODERNE */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-slate-900/50 p-6 rounded-2xl border border-white/5 backdrop-blur-xl">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-600/20 rounded-lg border border-blue-500/30">
                <TrendingUp className="w-6 h-6 text-blue-400" />
              </div>
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                Performance
              </h1>
            </div>
            <p className="text-slate-400 text-sm">
              {viewMode === 'month'
                ? `Analyse détaillée pour ${currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`
                : 'Analyse globale depuis le début de l\'activité'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {viewMode === 'month' && (
              <div className="flex items-center bg-slate-800/80 rounded-xl p-1 border border-white/10">
                <button onClick={prevMonth} className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-300">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-4 text-sm font-semibold text-white capitalize min-w-[120px] text-center">
                  {currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={nextMonth} className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-300">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
            
            <button 
              onClick={() => setViewMode(viewMode === 'month' ? 'all' : 'month')} 
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-white/10 text-sm font-medium transition-all text-slate-300 hover:text-white"
            >
              {viewMode === 'month' ? <Infinity className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
              {viewMode === 'month' ? 'Vue Globale' : 'Vue Mensuelle'}
            </button>
          </div>
        </div>

        {/* TABS & FILTERS BAR */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4 border-b border-white/5 pb-1">
          {/* Onglets Offres */}
          <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setActiveTab('global')}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                activeTab === 'global'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 border-blue-500/50 text-white shadow-lg shadow-blue-900/20'
                  : 'bg-slate-800/30 border-transparent text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              Global
            </button>

            {/* Offres Actives */}
            {activeOffers.map((offer) => (
              <button
                key={offer.id}
                onClick={() => setActiveTab(offer.name)}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all border whitespace-nowrap ${
                  activeTab === offer.name
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 border-emerald-500/50 text-white shadow-lg shadow-emerald-900/20'
                    : 'bg-slate-800/30 border-transparent text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {offer.name}
              </button>
            ))}

            {/* 🚀 Menu Déroulant Offres Inactives */}
            {inactiveOffers.length > 0 && (
              <div className="relative group">
                <select
                  value={inactiveOffers.some(o => o.name === activeTab) ? activeTab : "archives"}
                  onChange={(e) => setActiveTab(e.target.value)}
                  className={`appearance-none pl-10 pr-8 py-2.5 rounded-xl text-sm font-bold transition-all border cursor-pointer outline-none ${
                    inactiveOffers.some(o => o.name === activeTab)
                      ? 'bg-slate-700 border-slate-600 text-white'
                      : 'bg-slate-800/30 border-transparent text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                  }`}
                >
                  <option value="archives" disabled hidden>Archives ({inactiveOffers.length})</option>
                  {inactiveOffers.map(o => (
                    <option key={o.id} value={o.name} className="bg-slate-900 text-slate-300">
                      📦 {o.name}
                    </option>
                  ))}
                </select>
                <Archive className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${inactiveOffers.some(o => o.name === activeTab) ? 'text-white' : 'text-slate-500'}`} />
              </div>
            )}
          </div>

          {/* 🚀 Case à cocher "Inclure inactifs" (Visible seulement en Global) */}
          {activeTab === 'global' && (
            <button
              onClick={() => setIncludeInactiveInGlobal(!includeInactiveInGlobal)}
              className="flex items-center gap-2.5 px-4 py-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group"
            >
              <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${includeInactiveInGlobal ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600 group-hover:border-slate-500'}`}>
                {includeInactiveInGlobal && <CheckSquare className="w-3.5 h-3.5 text-white" />}
              </div>
              <span className={`text-sm font-medium transition-colors ${includeInactiveInGlobal ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'}`}>
                Inclure offres inactives
              </span>
            </button>
          )}
        </div>

        {/* KPI CARDS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <KpiCard 
            title="CA Généré" 
            value={`${formatCurrency(finalRevenue)} €`} 
            icon={DollarSign} 
            color="emerald" 
            trend="+12%" 
          />
          <KpiCard 
            title="Ventes Totales" 
            value={finalSales.toString()} 
            icon={ShoppingCart} 
            color="blue" 
          />
          <KpiCard 
            title="Taux de Conversion" 
            value={`${formatPercent(finalConversion)} %`} 
            icon={Target} 
            color="purple" 
          />
          <KpiCard 
            title="Mes Commissions" 
            value={`${formatCurrency(finalCommissions)} €`} 
            icon={Award} 
            color="amber" 
            glow 
          />
          <KpiCard 
            title="Taux de No Show" 
            value={`${finalNoShowRate.toFixed(1)} %`} 
            icon={UserX} 
            color="rose" 
          />
          <KpiCard 
            title="Deals Perdus" 
            value={finalLost.toString()} 
            icon={Ban} 
            color="slate" 
          />
        </div>

        {/* PERFORMANCE SUMMARY */}
        <div className="bg-slate-900/50 rounded-2xl p-8 border border-white/5 backdrop-blur-sm">
          <h2 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
              <Briefcase className="w-5 h-5 text-indigo-400" />
            </div>
            Vue d'ensemble Pipeline
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <SummaryItem label="Total Leads Traités" value={finalLeads} icon={Users} color="indigo" />
            <SummaryItem label="Deals en Cours" value={finalActiveCount} icon={Briefcase} color="cyan" />
            <SummaryItem label="Commission Moyenne" value={`${formatCurrency(finalAvgComm)} €`} icon={Award} color="amber" />
          </div>
        </div>
      </div>
    </div>
  );
}

// --- SUB-COMPONENTS FOR CLEANER CODE ---

const KpiCard = ({ title, value, icon: Icon, color, glow, trend }: any) => {
  const colors: any = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    slate: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
    indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  };

  const style = colors[color] || colors.slate;

  return (
    <div className={`relative p-6 rounded-2xl bg-slate-800/40 border border-white/5 backdrop-blur-md transition-all hover:bg-slate-800/60 group ${glow ? 'shadow-lg shadow-amber-500/10 border-amber-500/30' : ''}`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${style} group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">{trend}</span>}
      </div>
      <h3 className="text-slate-400 text-sm font-medium mb-1">{title}</h3>
      <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
    </div>
  );
};

const SummaryItem = ({ label, value, icon: Icon, color }: any) => {
  const colors: any = {
    indigo: 'text-indigo-400 bg-indigo-500/10',
    cyan: 'text-cyan-400 bg-cyan-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
  };
  return (
    <div className="flex items-center gap-5 p-4 rounded-xl hover:bg-white/5 transition-colors">
      <div className={`p-4 rounded-2xl ${colors[color]}`}>
        <Icon className="w-8 h-8" />
      </div>
      <div>
        <p className="text-slate-400 text-sm font-medium mb-1">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
      </div>
    </div>
  );
};