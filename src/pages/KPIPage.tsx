import React, { useState, useEffect } from 'react';
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
  UserX
} from 'lucide-react';
import { useOffers } from '../contexts/OffersContext';
import { useProspects } from '../contexts/ProspectsContext';

// ============================================================================
// UNIVERSAL DATA PARSING HELPERS (OMNIVORE MODE + KANBAN SUPPORT)
// ============================================================================

/**
 * INDESTRUCTIBLE KANBAN EXTRACTION: Parse ANY structure
 * Handles:
 * - Flat arrays: [deal1, deal2]
 * - Kanban objects: { col1: { items: [...] }, col2: { items: [...] } }
 * - Nested structures: { columns: { col1: { items: [...] } } }
 * - Direct arrays in values: { prospect: [...], gagne: [...] }
 */
const extractDealsFromKanban = (data: any): any[] => {
  if (!data) {
    console.warn('⚠️ extractDealsFromKanban: No data provided');
    return [];
  }

  // Case 1: Already a flat array (legacy format)
  if (Array.isArray(data)) {
    console.log('✅ Data is flat array:', data.length, 'items');
    return data;
  }

  // Case 2: It's an object - need to extract recursively
  const allDeals: any[] = [];

  const recursiveExtract = (obj: any, parentKey: string = ''): void => {
    if (!obj || typeof obj !== 'object') return;

    // Check if this object has a 'columns' property (nested Kanban)
    if (obj.columns && typeof obj.columns === 'object') {
      console.log('📦 Found nested columns structure');
      recursiveExtract(obj.columns, 'columns');
      return;
    }

    // Iterate over all keys
    Object.entries(obj).forEach(([key, value]: [string, any]) => {
      const columnKey = key.toLowerCase();

      // Case A: Value is directly an array of deals
      if (Array.isArray(value)) {
        console.log(`📋 Found array in key "${key}":`, value.length, 'items');

        value.forEach((item: any) => {
          if (!item || typeof item !== 'object') return;

          const deal = { ...item };

          // Force status based on column/key name
          if (
            columnKey.includes('gagn') ||
            columnKey.includes('won') ||
            columnKey.includes('sign') ||
            columnKey.includes('clos') ||
            columnKey.includes('fermé')
          ) {
            deal.status = 'Gagné';
            deal._sourceColumn = key;
          } else if (columnKey.includes('perdu') || columnKey.includes('lost')) {
            deal.status = 'Perdu';
            deal._sourceColumn = key;
          } else {
            if (!deal.status && !deal.statut) {
              deal.status = 'In Progress';
            }
            deal._sourceColumn = key;
          }

          allDeals.push(deal);
        });
      }
      // Case B: Value is an object that might be a column
      else if (value && typeof value === 'object') {
        const columnTitle = (value.title || value.name || '').toLowerCase();
        const items = value.items || value.deals || value.data || [];

        // Case B1: It's a column with items
        if (Array.isArray(items) && items.length > 0) {
          console.log(`📋 Found column "${key}" with items:`, items.length);

          items.forEach((item: any) => {
            if (!item || typeof item !== 'object') return;

            const deal = { ...item };
            const statusKey = (columnTitle || columnKey).toLowerCase();

            // Force status based on column
            if (
              statusKey.includes('gagn') ||
              statusKey.includes('won') ||
              statusKey.includes('sign') ||
              statusKey.includes('clos') ||
              statusKey.includes('fermé')
            ) {
              deal.status = 'Gagné';
              deal._sourceColumn = columnTitle || key;
            } else if (statusKey.includes('perdu') || statusKey.includes('lost')) {
              deal.status = 'Perdu';
              deal._sourceColumn = columnTitle || key;
            } else {
              if (!deal.status && !deal.statut) {
                deal.status = 'In Progress';
              }
              deal._sourceColumn = columnTitle || key;
            }

            allDeals.push(deal);
          });
        }
        // Case B2: Nested object - recurse
        else {
          recursiveExtract(value, key);
        }
      }
    });
  };

  recursiveExtract(data);
  console.log('✅ Total deals extracted:', allDeals.length);
  return allDeals;
};

/**
 * OMNIVORE: Extract amount from ANY possible field name
 * Tries: amount, price, prix, montant, value, total
 * Handles: "1 200 €", "1,200.50", 1500, etc.
 */
const getDealAmount = (deal: any): number => {
  // Try all possible field names
  const possibleFields = [
    deal.amount,
    deal.price,
    deal.prix,
    deal.montant,
    deal.value,
    deal.total,
    deal.Amount, // Try capitalized versions too
    deal.Price,
  ];

  for (const value of possibleFields) {
    if (value !== undefined && value !== null && value !== '') {
      // Parse the value
      if (typeof value === 'number' && !isNaN(value)) {
        return value > 0 ? value : 0;
      }

      try {
        let str = String(value).trim();

        // Step 1: Remove currency symbols and letter characters
        str = str.replace(/[€$£A-Za-z]/g, '');

        // Step 2: Remove spaces (used as thousand separators)
        str = str.replace(/\s+/g, '');

        // Step 3: Handle different decimal formats
        if (/,\d{1,2}$/.test(str)) {
          str = str.replace(',', '.');
        } else {
          str = str.replace(/,/g, '');
        }

        const num = parseFloat(str);
        if (!isNaN(num) && num > 0) {
          return num;
        }
      } catch (e) {
        // Continue to next field
      }
    }
  }

  return 0;
};

/**
 * OMNIVORE: Check if deal is WON (case-insensitive, multiple variations)
 */
const isWonDeal = (deal: any): boolean => {
  const status = deal.status || deal.statut || deal.state || '';
  const s = String(status).toLowerCase();
  return (
    s.includes('gagn') ||
    s.includes('won') ||
    s.includes('sign') ||
    s.includes('closed') ||
    s.includes('clos') ||
    s === 'won' ||
    s === 'gagné' ||
    s === 'gagne'
  );
};

/**
 * OMNIVORE: Check if deal is LOST
 */
const isLostDeal = (deal: any): boolean => {
  const status = deal.status || deal.statut || deal.state || '';
  const s = String(status).toLowerCase();
  return s.includes('perdu') || s.includes('lost');
};

/**
 * OMNIVORE: Parse date from multiple possible fields
 */
const getDealDate = (deal: any): Date => {
  const possibleFields = [
    deal.createdAt,
    deal.date,
    deal.creationDate,
    deal.dateCreation,
    deal.created_at,
  ];

  for (const value of possibleFields) {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return new Date();
};

/**
 * OMNIVORE: Get offer name from deal
 */
const getDealOffer = (deal: any): string => {
  return String(
    deal.offer || deal.offerName || deal.offre || deal.offer_name || ''
  ).toLowerCase();
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function KPIPage() {
  const { offers: allOffers } = useOffers();
  const { prospects: allProspects } = useProspects();
  const offers = allOffers.filter(offer => offer.status === 'active');

  useEffect(() => {
    console.log('🔗 KPI Page connected to OffersContext & ProspectsContext');
  }, [allOffers, offers, allProspects]);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'all'>('all'); 
  const [activeTab, setActiveTab] = useState('global');
  const [deals, setDeals] = useState<any[]>([]);

  useEffect(() => {
    const loadData = () => {
      try {
        const pipelineData = localStorage.getItem('closeros_pipeline');
        if (pipelineData) {
          const parsed = JSON.parse(pipelineData);
          const dealsArray = extractDealsFromKanban(parsed);
          setDeals(dealsArray);
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

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const selectedOffer = activeTab !== 'global'
    ? offers.find(o => o?.name?.toLowerCase() === activeTab?.toLowerCase())
    : null;
  const selectedOfferId = selectedOffer?.id;

  const filteredProspects = allProspects.filter((prospect) => {
    try {
      if (activeTab !== 'global') {
        if (prospect?.offerId) {
          if (prospect.offerId !== selectedOfferId &&
              String(prospect.offerId) !== String(selectedOfferId) &&
              Number(prospect.offerId) !== Number(selectedOfferId)) {
            return false;
          }
        } else if (prospect?.offer) {
          const prospectOffer = prospect.offer.toLowerCase();
          const tabName = activeTab.toLowerCase();
          if (!prospectOffer.includes(tabName) && !tabName.includes(prospectOffer)) {
            return false;
          }
        } else {
          return false;
        }
      }

      if (viewMode === 'month') {
        const prospectDate = prospect?.dateAdded ? new Date(prospect.dateAdded) : new Date();
        if (
          prospectDate.getMonth() !== currentDate.getMonth() ||
          prospectDate.getFullYear() !== currentDate.getFullYear()
        ) {
          return false;
        }
      }
      return true;
    } catch (error) {
      return false;
    }
  });

  const wonDeals = filteredProspects.filter(p => p?.stage === 'won') || [];
  const lostDeals = filteredProspects.filter(p => p?.stage === 'lost') || [];

  const followUpDeals = filteredProspects.filter(p => {
    const s = (p?.status || p?.stage || '').toLowerCase();
    return s.includes('follow') || s.includes('relance');
  }) || [];

  const noShowDeals = filteredProspects.filter(p => {
    const s = (p?.status || p?.stage || '').toLowerCase();
    return s.includes('no show') || s.includes('absent') || s.includes('noshow');
  }) || [];

  const activeDeals = filteredProspects.filter(p => p?.stage && p.stage !== 'won' && p.stage !== 'lost') || [];

  const totalRevenue = wonDeals.reduce((sum, p) => sum + (p?.value || 0), 0) || 0;
  const totalSales = wonDeals.length || 0;
  const totalLeads = filteredProspects.length || 0;
  const closedDeals = (wonDeals.length || 0) + (lostDeals.length || 0);
  const conversionRate = closedDeals > 0 ? ((totalSales / closedDeals) * 100) || 0 : 0;
  const avgBasket = totalSales > 0 ? (totalRevenue / totalSales) || 0 : 0;

  const totalCallOutcomes = wonDeals.length + lostDeals.length + followUpDeals.length + noShowDeals.length;
  const noShowRate = totalCallOutcomes > 0 ? ((noShowDeals.length / totalCallOutcomes) * 100) : 0;

  const parseCommissionRate = (commissionStr?: string): number => {
    if (!commissionStr) return 0.10
    try {
      const match = commissionStr.match(/(\d+(?:\.\d+)?)/)
      return match ? parseFloat(match[1]) / 100 : 0.10
    } catch (error) {
      return 0.10
    }
  }

  const totalCommissions = wonDeals.reduce((sum, deal) => {
    if (!deal?.value) return sum;
    const dealOffer = offers.find(o =>
      (deal.offerId && (String(o.id) === String(deal.offerId))) ||
      (deal.offer && o.name.toLowerCase() === deal.offer.toLowerCase())
    );
    const rate = dealOffer?.commission ? parseCommissionRate(dealOffer.commission) : 0.10;
    return sum + (deal.value * rate);
  }, 0);

  const avgCommission = totalSales > 0 ? (totalCommissions / totalSales) : 0;

  const filteredDeals = deals.filter((deal) => {
    if (viewMode === 'month') {
      const dealDate = getDealDate(deal);
      if (dealDate.getMonth() !== currentDate.getMonth() || dealDate.getFullYear() !== currentDate.getFullYear()) return false;
    }
    if (activeTab !== 'global') {
      const dealOffer = getDealOffer(deal);
      const tabName = activeTab.toLowerCase();
      if (!dealOffer.includes(tabName) && !tabName.includes(dealOffer)) return false;
    }
    return true;
  });

  const legacyWonDeals = filteredDeals.filter((deal) => isWonDeal(deal));
  const legacyRevenue = legacyWonDeals.reduce((sum, deal) => sum + getDealAmount(deal), 0);
  const legacyCommissions = legacyRevenue * 0.10
  const hasLegacyData = deals.length > 0 && filteredDeals.length > 0;
  const hasContextData = allProspects.length > 0 && filteredProspects.length > 0;

  const finalRevenue = hasContextData ? totalRevenue : (hasLegacyData ? legacyRevenue : 0);
  const finalSales = hasContextData ? totalSales : (hasLegacyData ? legacyWonDeals.length : 0);
  const finalLeads = hasContextData ? totalLeads : (hasLegacyData ? filteredDeals.length : 0);
  const finalConversion = hasContextData ? conversionRate : (hasLegacyData && filteredDeals.length > 0 ? (legacyWonDeals.length / filteredDeals.length) * 100 : 0);
  const finalNoShowRate = hasContextData ? noShowRate : 0;
  const finalCommissions = hasContextData ? totalCommissions : (hasLegacyData ? legacyCommissions : 0);
  const finalAvgCommission = hasContextData ? avgCommission : (hasLegacyData && legacyWonDeals.length > 0 ? legacyCommissions / legacyWonDeals.length : 0);
  const finalLostDeals = hasContextData ? lostDeals.length : (hasLegacyData ? legacyLostDeals.length : 0);
  const finalActiveDeals = hasContextData ? activeDeals.length : 0;

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number): string => value.toFixed(1);

  return (
    <div className="min-h-screen bg-gray-900 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              KPI Dashboard
            </h1>
            <p className="text-gray-400 mt-1">
              {viewMode === 'month'
                ? currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
                : 'Depuis toujours'}
            </p>
          </div>

          <div className="flex flex-col items-end gap-3">
            {viewMode === 'month' && (
              <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 border border-gray-700">
                <button onClick={prevMonth} className="p-1.5 hover:bg-gray-700 rounded transition-colors">
                  <ChevronLeft className="w-5 h-5 text-gray-300" />
                </button>
                <span className="text-white font-medium min-w-[140px] text-center capitalize">
                  {currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={nextMonth} className="p-1.5 hover:bg-gray-700 rounded transition-colors">
                  <ChevronRight className="w-5 h-5 text-gray-300" />
                </button>
              </div>
            )}
            <button onClick={() => setViewMode(viewMode === 'month' ? 'all' : 'month')} className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">
              {viewMode === 'month' ? <><Infinity className="w-4 h-4" />Voir depuis toujours</> : <><Calendar className="w-4 h-4" />Revenir au mois en cours</>}
            </button>
          </div>
        </div>

        {/* OFFER TABS */}
        <div className="flex gap-2 overflow-x-auto pb-2 border-b border-gray-800">
          <button onClick={() => setActiveTab('global')} className={`px-4 py-2 rounded-t-lg font-medium transition-all whitespace-nowrap ${activeTab === 'global' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Global</button>
          {offers.map((offer) => (
            <button key={offer.id} onClick={() => setActiveTab(offer.name)} className={`px-4 py-2 rounded-t-lg font-medium transition-all whitespace-nowrap ${activeTab === offer.name ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>{offer.name}</button>
          ))}
        </div>

        {offers.length === 0 && (
          <div className="bg-yellow-900/20 border border-yellow-500/50 rounded-xl p-6 flex items-center gap-4">
            <div className="text-yellow-500 text-3xl">ℹ️</div>
            <div>
              <h3 className="text-yellow-400 font-bold text-lg">Aucune offre active disponible</h3>
              <p className="text-gray-300 text-sm mt-1">Créez une nouvelle offre dans la page <a href="/offers" className="underline text-blue-400 hover:text-blue-300">Offres</a> pour voir des onglets spécifiques ici.</p>
            </div>
          </div>
        )}

        {/* KPI CARDS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-all">
            <div className="flex items-center gap-3 mb-4"><div className="p-3 bg-green-900/30 rounded-lg"><DollarSign className="w-6 h-6 text-green-500" /></div><h3 className="text-gray-400 text-sm font-medium">CA Généré</h3></div>
            <p className="text-3xl md:text-4xl font-bold text-white">{formatCurrency(finalRevenue)} €</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-all">
            <div className="flex items-center gap-3 mb-4"><div className="p-3 bg-blue-900/30 rounded-lg"><ShoppingCart className="w-6 h-6 text-blue-500" /></div><h3 className="text-gray-400 text-sm font-medium">Ventes</h3></div>
            <p className="text-3xl md:text-4xl font-bold text-white">{finalSales}</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-all">
            <div className="flex items-center gap-3 mb-4"><div className="p-3 bg-purple-900/30 rounded-lg"><Target className="w-6 h-6 text-purple-500" /></div><h3 className="text-gray-400 text-sm font-medium">Conversion</h3></div>
            <p className="text-3xl md:text-4xl font-bold text-white">{formatPercent(finalConversion)} %</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-6 border-2 border-blue-500 hover:border-blue-400 transition-all shadow-lg shadow-blue-500/20">
            <div className="flex items-center gap-3 mb-4"><div className="p-3 bg-orange-900/30 rounded-lg"><Award className="w-6 h-6 text-orange-500" /></div><h3 className="text-gray-400 text-sm font-medium">Commissions</h3></div>
            <p className="text-3xl md:text-4xl font-bold text-white">{formatCurrency(finalCommissions)} €</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-all">
            <div className="flex items-center gap-3 mb-4"><div className="p-3 bg-red-900/30 rounded-lg"><UserX className="w-6 h-6 text-red-500" /></div><h3 className="text-gray-400 text-sm font-medium">Taux de No Show</h3></div>
            <p className="text-3xl md:text-4xl font-bold text-white">{finalNoShowRate.toFixed(1)} %</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-all">
            <div className="flex items-center gap-3 mb-4"><div className="p-3 bg-red-900/30 rounded-lg"><Ban className="w-6 h-6 text-red-500" /></div><h3 className="text-gray-400 text-sm font-medium">Deals Perdus</h3></div>
            <p className="text-3xl md:text-4xl font-bold text-white">{finalLostDeals}</p>
          </div>
        </div>

        {/* PERFORMANCE SUMMARY */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Briefcase className="w-5 h-5 text-blue-500" />Résumé de Performance</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center gap-4"><div className="p-3 bg-indigo-900/30 rounded-lg"><Users className="w-6 h-6 text-indigo-400" /></div><div><p className="text-gray-400 text-sm">Total Leads</p><p className="text-2xl font-bold text-white">{finalLeads}</p></div></div>
            <div className="flex items-center gap-4"><div className="p-3 bg-blue-900/30 rounded-lg"><Briefcase className="w-6 h-6 text-blue-400" /></div><div><p className="text-gray-400 text-sm">Deals en Pipeline</p><p className="text-2xl font-bold text-white">{finalActiveDeals}</p></div></div>
            <div className="flex items-center gap-4"><div className="p-3 bg-yellow-900/30 rounded-lg"><Award className="w-6 h-6 text-yellow-400" /></div><div><p className="text-gray-400 text-sm">Commission Moyenne</p><p className="text-2xl font-bold text-white">{formatCurrency(finalAvgCommission)} €</p></div></div>
          </div>
        </div>
      </div>
    </div>
  );
}