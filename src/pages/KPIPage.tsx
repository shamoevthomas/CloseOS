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
import { useOffers } from '../contexts/OffersContext';
import { useProspects } from '../contexts/ProspectsContext';

// ============================================================================
// UNIVERSAL DATA PARSING HELPERS
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

  // --- LOGIQUE OFFRES (Active vs Inactive) ---
  const isExpired = (offer: any) => {
    if (!offer.endDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(offer.endDate);
    return end < today;
  };

  // Active = Status Active ET Pas expiré
  const activeOffers = useMemo(() => allOffers.filter(o => o.status === 'active' && !isExpired(o)), [allOffers]);
  
  // Inactive = Status Inactive OU (Active mais Expiré)
  const inactiveOffers = useMemo(() => allOffers.filter(o => o.status === 'inactive' || (o.status === 'active' && isExpired(o))), [allOffers]);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'all'>('all'); 
  const [activeTab, setActiveTab] = useState('global');
  const [deals, setDeals] = useState<any[]>([]);
  
  // État pour inclure ou non les offres inactives dans le Global
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
  
  // 🚀 CORRECTION : Matching plus souple pour le Global (comme dans les onglets)
  const isActiveOffer = (itemName: string | undefined, itemId: string | number | undefined) => {
    // 1. Vérification par ID
    if (itemId) {
      if (activeOffers.some(o => String(o.id) === String(itemId))) return true;
    }
    
    // 2. Vérification par Nom (Contient ou Est Contenu)
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

  // --- PREPARATION DES DONNÉES ---

  // 1. Filtrage GLOBAL (sans filtre de date pour les graphiques)
  const allFilteredItems = useMemo(() => {
    const sourceData = allProspects.length > 0 ? allProspects : deals;
    
    return sourceData.filter(item => {
      // Filtre par Onglet (Offre)
      if (activeTab !== 'global') {
        const tabName = activeTab.toLowerCase();
        const pOffer = (getDealOffer(item)).toLowerCase();
        const pOfferId = String(item.offerId || '');
        
        const targetOffer = allOffers.find(o => o.name.toLowerCase() === tabName);
        
        const matchName = pOffer.includes(tabName) || tabName.includes(pOffer);
        const matchId = targetOffer && pOfferId === String(targetOffer.id);

        if (!matchName && !matchId) return false;
      } else {
        // Filtre Global : Gestion de la case à cocher "Inclure inactifs"
        if (!includeInactiveInGlobal) {
          if (!isActiveOffer(item.offer || item.offerName, item.offerId)) return false;
        }
      }
      return true;
    });
  }, [activeTab, includeInactiveInGlobal, allProspects, deals, allOffers]);

  // 2. Données pour les KPI (Filtre date appliqué si nécessaire)
  const kpiData = useMemo(() => {
    return allFilteredItems.filter(item => {
      if (viewMode === 'month') {
        const dDate = getDealDate(item);
        if (dDate.getMonth() !== currentDate.getMonth() || dDate.getFullYear() !== currentDate.getFullYear()) return false;
      }
      return true;
    });
  }, [allFilteredItems, viewMode, currentDate]);

  // 3. Données pour les GRAPHIQUES (Historique complet agrégé par mois)
  const chartData = useMemo(() => {
    const grouped: Record<string, { won: number; total: number; commission: number; date: Date }> = {};

    allFilteredItems.forEach(item => {
      const date = getDealDate(item);
      // Clé de tri YYYY-MM
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!grouped[key]) {
        grouped[key] = { won: 0, total: 0, commission: 0, date };
      }

      const isWon = isWonDeal(item);
      const isLost = isLostDeal(item);

      if (isWon || isLost) {
        grouped[key].total += 1;
        if (isWon) {
          grouped[key].won += 1;
          const val = item.value || getDealAmount(item);
          // Recalcul commission si besoin
          let comm = 0;
          if (allProspects.length > 0) {
             const dealOffer = allOffers.find(o => (item.offerId && String(o.id) === String(item.offerId)) || (item.offer && o.name.toLowerCase() === item.offer.toLowerCase()));
             const rate = dealOffer?.commission ? parseCommission(dealOffer.commission) : 0.10;
             comm = val * rate;
          } else {
             comm = val * 0.10; // Legacy default
          }
          grouped[key].commission += comm;
        }
      }
    });

    // Transformer en tableau et trier par date
    return Object.entries(grouped)
      .map(([key, data]) => ({
        label: data.date.toLocaleDateString('fr-FR', { month: 'short' }), // "janv."
        fullDate: data.date,
        closingRate: data.total > 0 ? (data.won / data.total) * 100 : 0,
        commission: data.commission
      }))
      .sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime())
      // Garder les 6 derniers mois pour la lisibilité
      .slice(-6); 
  }, [allFilteredItems, allOffers]);


  // --- CALCULS KPI FINAUX (sur kpiData) ---
  const wonDeals = kpiData.filter(p => isWonDeal(p));
  const lostDeals = kpiData.filter(p => isLostDeal(p));
  const followUpDeals = kpiData.filter(p => (p.status || p.stage || '').toLowerCase().match(/follow|relance/));
  const noShowDeals = kpiData.filter(p => (p.status || p.stage || '').toLowerCase().match(/no show|absent|noshow/));
  const activeDeals = kpiData.filter(p => !isWonDeal(p) && !isLostDeal(p));

  const totalRevenue = wonDeals.reduce((sum, p) => sum + (p.value || getDealAmount(p)), 0);
  const totalSales = wonDeals.length;
  const totalLeads = kpiData.length;
  const closedDeals = wonDeals.length + lostDeals.length;
  const conversionRate = closedDeals > 0 ? (totalSales / closedDeals) * 100 : 0;
  
  const totalCallOutcomes = wonDeals.length + lostDeals.length + followUpDeals.length + noShowDeals.length;
  const noShowRate = totalCallOutcomes > 0 ? (noShowDeals.length / totalCallOutcomes) * 100 : 0;

  const totalCommissions = wonDeals.reduce((sum, deal) => {
    const val = deal.value || getDealAmount(deal);
    const dealOffer = allOffers.find(o => (deal.offerId && String(o.id) === String(deal.offerId)) || (deal.offer && o.name.toLowerCase() === deal.offer.toLowerCase()));
    const rate = dealOffer?.commission ? parseCommission(dealOffer.commission) : 0.10;
    return sum + (val * rate);
  }, 0);

  const avgCommission = totalSales > 0 ? totalCommissions / totalSales : 0;

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
            value={`${formatCurrency(totalRevenue)} €`} 
            icon={DollarSign} 
            color="emerald" 
            trend="+12%" 
          />
          <KpiCard 
            title="Ventes Totales" 
            value={totalSales.toString()} 
            icon={ShoppingCart} 
            color="blue" 
          />
          <KpiCard 
            title="Taux de Conversion" 
            value={`${formatPercent(conversionRate)} %`} 
            icon={Target} 
            color="purple" 
          />
          <KpiCard 
            title="Mes Commissions" 
            value={`${formatCurrency(totalCommissions)} €`} 
            icon={Award} 
            color="amber" 
            glow 
          />
          <KpiCard 
            title="Taux de No Show" 
            value={`${noShowRate.toFixed(1)} %`} 
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

        {/* 🚀 NOUVEAU: SECTION GRAPHIQUES */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Graphique Taux de Closing */}
          <div className="bg-slate-900/50 rounded-2xl p-6 border border-white/5 backdrop-blur-sm">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-400" />
              Évolution Taux de Closing
            </h3>
            <div className="h-64">
              <TrendChart 
                data={chartData} 
                dataKey="closingRate" 
                color="#a855f7" // Purple
                suffix="%" 
              />
            </div>
          </div>

          {/* Graphique Commissions */}
          <div className="bg-slate-900/50 rounded-2xl p-6 border border-white/5 backdrop-blur-sm">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-400" />
              Évolution Commissions
            </h3>
            <div className="h-64">
              <TrendChart 
                data={chartData} 
                dataKey="commission" 
                color="#10b981" // Emerald
                suffix="€" 
              />
            </div>
          </div>
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
            <SummaryItem label="Total Leads Traités" value={totalLeads} icon={Users} color="indigo" />
            <SummaryItem label="Deals en Cours" value={activeDeals.length} icon={Briefcase} color="cyan" />
            <SummaryItem label="Commission Moyenne" value={`${formatCurrency(avgCommission)} €`} icon={Award} color="amber" />
          </div>
        </div>
      </div>
    </div>
  );
}

// --- NOUVEAU COMPOSANT GRAPHIQUE (SVG Custom) ---
const TrendChart = ({ data, dataKey, color, suffix }: { data: any[], dataKey: string, color: string, suffix: string }) => {
  if (!data || data.length === 0) {
    return <div className="h-full flex items-center justify-center text-slate-500 text-sm">Pas assez de données pour l'historique</div>;
  }

  // Dimensions
  const height = 200;
  const width = 500; // viewBox width
  const padding = 20;

  // Calculs min/max
  const values = data.map(d => d[dataKey]);
  const min = 0;
  const max = Math.max(...values, 10); // Au moins 10 pour éviter division par 0

  // Fonction de mise à l'échelle Y (inversée car SVG commence en haut)
  const getY = (val: number) => height - padding - ((val - min) / (max - min)) * (height - 2 * padding);
  
  // Fonction de mise à l'échelle X
  const getX = (index: number) => padding + (index / (data.length - 1)) * (width - 2 * padding);

  // Construction du chemin SVG (Line)
  const pathData = data.length > 1 ? data.map((d, i) => 
    `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d[dataKey])}`
  ).join(' ') : `M ${getX(0)} ${getY(values[0])} L ${getX(0) + 10} ${getY(values[0])}`; // Point seul si 1 donnée

  // Construction de la zone remplie (Area) pour l'effet dégradé
  const areaData = `${pathData} L ${getX(data.length - 1)} ${height} L ${getX(0)} ${height} Z`;

  return (
    <div className="w-full h-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
        {/* Dégradé de remplissage */}
        <defs>
          <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Lignes de grille horizontales */}
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
          const y = height - padding - ratio * (height - 2 * padding);
          return (
            <g key={ratio}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />
              <text x={0} y={y + 3} fill="rgba(255,255,255,0.3)" fontSize="10" textAnchor="start">
                {Math.round(min + ratio * (max - min))}{suffix === '%' ? '' : 'k' /* Simplification affichage */}
              </text>
            </g>
          );
        })}

        {/* Zone remplie */}
        <path d={areaData} fill={`url(#gradient-${dataKey})`} />

        {/* Ligne de courbe */}
        <path d={pathData} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        {/* Points et Labels */}
        {data.map((d, i) => (
          <g key={i} className="group">
            {/* Point */}
            <circle cx={getX(i)} cy={getY(d[dataKey])} r="4" fill="#1e293b" stroke={color} strokeWidth="2" />
            
            {/* Tooltip au survol (CSS group-hover) */}
            <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <rect x={getX(i) - 25} y={getY(d[dataKey]) - 35} width="50" height="25" rx="4" fill="#0f172a" stroke={color} />
              <text x={getX(i)} y={getY(d[dataKey]) - 18} fill="white" fontSize="10" textAnchor="middle" fontWeight="bold">
                {Math.round(d[dataKey])}{suffix}
              </text>
            </g>

            {/* Label Mois (Axe X) */}
            <text x={getX(i)} y={height} fill="rgba(255,255,255,0.5)" fontSize="10" textAnchor="middle">
              {d.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

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