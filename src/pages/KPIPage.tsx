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

        // Remove all non-numeric chars except digits, comma, and period
        // But first, save the original for debugging
        const original = str;

        // Step 1: Remove currency symbols and letter characters
        str = str.replace(/[€$£A-Za-z]/g, '');

        // Step 2: Remove spaces (used as thousand separators)
        str = str.replace(/\s+/g, '');

        // Step 3: Handle different decimal formats
        // French: "2,100" or "2.100,50"
        // English: "2,100.50" or "2100.50"

        // If there's a comma and it's followed by 1-2 digits at the end, it's decimal
        if (/,\d{1,2}$/.test(str)) {
          // French format: "2100,50" -> "2100.50"
          str = str.replace(',', '.');
        } else {
          // Otherwise, comma is thousand separator: "2,100" -> "2100"
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
 * Matches: "Gagné", "gagné", "Won", "won", "Signé", "Closed", "clos", etc.
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
 * Tries: createdAt, date, creationDate, dateCreation, created_at
 * Fallback: new Date() (today) so data isn't hidden
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

  // Fallback to today so the deal shows up somewhere
  return new Date();
};

/**
 * OMNIVORE: Get offer name from deal
 * Tries: offer, offerName, offre, offer_name
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
  // Get offers from context (Single Source of Truth)
  const { offers: allOffers } = useOffers();

  // Get prospects/deals from context (Pipeline data)
  const { prospects: allProspects } = useProspects();

  // Only show active offers in tabs
  const offers = allOffers.filter(offer => offer.status === 'active');

  // Log contexts connection
  useEffect(() => {
    console.log('🔗 KPI Page connected to OffersContext & ProspectsContext');
    console.log('📋 Total offers:', allOffers.length);
    console.log('✅ Active offers:', offers.length);
    console.log('📊 Offers:', offers.map(o => o.name));
    console.log('👥 Total prospects/deals:', allProspects.length);
  }, [allOffers, offers, allProspects]);

  // State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'all'>('all'); // DEFAULT: 'all' pour voir toutes les données
  const [activeTab, setActiveTab] = useState('global');
  const [deals, setDeals] = useState<any[]>([]);

  // FONCTION DE SECOURS: Injecter des données de test
  const injectTestData = () => {
    const testData = {
      gagne: {
        id: 'gagne',
        title: 'Gagné',
        items: [
          {
            id: '1',
            title: 'Deal Test 1',
            client: 'Client A',
            amount: 1500,
            price: 1500,
            createdAt: new Date().toISOString(),
            offer: 'Service Premium',
          },
          {
            id: '2',
            title: 'Deal Test 2',
            client: 'Client B',
            amount: 603,
            createdAt: new Date().toISOString(),
            offer: 'Service Standard',
          },
        ],
      },
      prospect: {
        id: 'prospect',
        title: 'Prospect',
        items: [
          {
            id: '3',
            title: 'Deal Test 3',
            client: 'Client C',
            amount: 800,
            createdAt: new Date().toISOString(),
            offer: 'Service Basic',
          },
        ],
      },
    };

    const testOffers = [
      { id: '1', name: 'Service Premium' },
      { id: '2', name: 'Service Standard' },
      { id: '3', name: 'Service Basic' },
    ];

    localStorage.setItem('closeros_pipeline', JSON.stringify(testData));
    localStorage.setItem('closeros_offers', JSON.stringify(testOffers));

    alert('✅ Données de test injectées ! La page va se recharger.');
    window.location.reload();
  };

  // Load data from localStorage (with Kanban support)
  useEffect(() => {
    const loadData = () => {
      try {
        const pipelineData = localStorage.getItem('closeros_pipeline');

        if (pipelineData) {
          const parsed = JSON.parse(pipelineData);

          // Use deep extraction to handle both flat arrays and Kanban structures
          const dealsArray = extractDealsFromKanban(parsed);
          setDeals(dealsArray);

          // Debug logging
          console.log('🔍 KPI Data Loaded (Kanban Mode):', dealsArray.length, 'deals');
          console.log('📦 Original structure:', parsed);
          console.log('📦 Structure type:', Array.isArray(parsed) ? 'Array' : 'Kanban Object');

          if (dealsArray.length > 0) {
            console.log('📊 All extracted deals:', dealsArray);
            console.log('📊 Sample deal:', dealsArray[0]);
            console.log('💰 Amount fields:', {
              amount: dealsArray[0].amount,
              price: dealsArray[0].price,
              prix: dealsArray[0].prix,
              montant: dealsArray[0].montant,
              value: dealsArray[0].value,
            });
            console.log('✅ Status:', dealsArray[0].status || dealsArray[0].statut);
            console.log('📂 Source column:', dealsArray[0]._sourceColumn);

            // Log won deals specifically
            const wonDealsDebug = dealsArray.filter((d) => {
              const s = (d.status || '').toLowerCase();
              return s.includes('gagn') || s === 'gagné';
            });
            console.log('🏆 Won deals found:', wonDealsDebug.length, wonDealsDebug);
          }
        } else {
          console.warn('⚠️ No pipeline data found in localStorage');
          setDeals([]);
        }

        // Note: Offers are now loaded from OffersContext (global state)
      } catch (error) {
        console.error('❌ Error loading KPI data:', error);
        setDeals([]);
      }
    };

    loadData();
    // Refresh when window gains focus
    window.addEventListener('focus', loadData);
    return () => window.removeEventListener('focus', loadData);
  }, []);

  // Date navigation
  const nextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    );
  };

  const prevMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    );
  };

  // ============================================================================
  // REAL KPI CALCULATIONS FROM PROSPECTS CONTEXT
  // ============================================================================

  // Find the selected offer ID with defensive checks
  const selectedOffer = activeTab !== 'global'
    ? offers.find(o => o?.name?.toLowerCase() === activeTab?.toLowerCase())
    : null;
  const selectedOfferId = selectedOffer?.id;

  // Filter prospects based on selected offer tab
  const filteredProspects = allProspects.filter((prospect) => {
    try {
      // Filter by offer
      if (activeTab !== 'global') {
        // Filter by offerId if available, otherwise by offer name
        if (prospect?.offerId) {
          // Type-safe comparison
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
          return false; // No offer info, exclude from filtered results
        }
      }

      // Filter by date if in month mode
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
      console.error('Error filtering prospect:', prospect, error);
      return false;
    }
  });

  // Calculate KPIs from real prospect data with defensive checks
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

  // Parse commission rate from selected offer (e.g., "11%" -> 0.11)
  const parseCommissionRate = (commissionStr?: string): number => {
    if (!commissionStr) return 0.10
    try {
      const match = commissionStr.match(/(\d+(?:\.\d+)?)/)
      return match ? parseFloat(match[1]) / 100 : 0.10
    } catch (error) {
      console.warn('Failed to parse commission rate:', commissionStr, error)
      return 0.10
    }
  }

  // =================================================================
  // FIXED LOGIC: DIRECT SUMMATION (Matches Cockpit Accuracy)
  // =================================================================

  // Calculate total commissions by summing each deal's specific commission
  const totalCommissions = wonDeals.reduce((sum, deal) => {
    if (!deal?.value) return sum;

    // 1. Find the Offer linked to this specific deal
    // Uses the 'offers' context variable (safe access)
    const dealOffer = offers.find(o =>
      // Check by ID (robust string/number comparison)
      (deal.offerId && (String(o.id) === String(deal.offerId))) ||
      // Fallback: Check by Name if ID is missing
      (deal.offer && o.name.toLowerCase() === deal.offer.toLowerCase())
    );

    // 2. Get the rate for THIS deal (Fallback to 10% only if offer not found)
    const rate = dealOffer?.commission ? parseCommissionRate(dealOffer.commission) : 0.10;

    // 3. Add exact commission for this deal to the pile
    return sum + (deal.value * rate);
  }, 0);

  // Calculate average based on this accurate total
  const avgCommission = totalSales > 0 ? (totalCommissions / totalSales) : 0;

  // Enhanced debug logging for commission calculations
  if (wonDeals.length > 0) {
    console.log('💰 Commission Breakdown (Direct Summation):');
    let debugTotal = 0;
    wonDeals.forEach((deal, idx) => {
      const dealOffer = offers.find(o =>
        (deal.offerId && (String(o.id) === String(deal.offerId))) ||
        (deal.offer && o.name.toLowerCase() === deal.offer.toLowerCase())
      );
      const rate = dealOffer?.commission ? parseCommissionRate(dealOffer.commission) : 0.10;
      const commission = (deal.value || 0) * rate;
      debugTotal += commission;

      console.log(`  ${idx + 1}. ${deal.contact || deal.company}:`, {
        value: `${deal.value}€`,
        offerId: deal.offerId,
        offerName: deal.offer,
        matchedOffer: dealOffer?.name || 'Not found',
        rate: `${(rate * 100).toFixed(2)}%`,
        commission: `${commission.toFixed(2)}€`
      });
    });
    console.log(`  📊 Total Commissions: ${debugTotal.toFixed(2)}€ (Should match: ${totalCommissions.toFixed(2)}€)`);
  }

  // ============================================================================
  // LEGACY: Filter deals from localStorage (for backward compatibility)
  // ============================================================================

  const filteredDeals = deals.filter((deal) => {
    // Filter by date
    if (viewMode === 'month') {
      const dealDate = getDealDate(deal);
      if (
        dealDate.getMonth() !== currentDate.getMonth() ||
        dealDate.getFullYear() !== currentDate.getFullYear()
      ) {
        return false;
      }
    }

    // Filter by offer (permissive matching with includes)
    if (activeTab !== 'global') {
      const dealOffer = getDealOffer(deal);
      const tabName = activeTab.toLowerCase();
      if (!dealOffer.includes(tabName) && !tabName.includes(dealOffer)) {
        return false;
      }
    }

    return true;
  });

  // Legacy calculations (kept for backward compatibility with localStorage data)
  const legacyWonDeals = filteredDeals.filter((deal) => isWonDeal(deal));
  const legacyLostDeals = filteredDeals.filter((deal) => isLostDeal(deal));
  const legacyRevenue = legacyWonDeals.reduce((sum, deal) => sum + getDealAmount(deal), 0);

  // Calculate legacy commissions using default 10% (legacy data lacks offer linking)
  const legacyCommissions = legacyRevenue * 0.10

  // If we have legacy data from localStorage AND no context data, use legacy
  // Otherwise, prefer context data
  const hasLegacyData = deals.length > 0 && filteredDeals.length > 0;
  const hasContextData = allProspects.length > 0 && filteredProspects.length > 0;

  // Use context data by default, fallback to legacy if no context data
  const finalRevenue = hasContextData ? totalRevenue : (hasLegacyData ? legacyRevenue : 0);
  const finalSales = hasContextData ? totalSales : (hasLegacyData ? legacyWonDeals.length : 0);
  const finalLeads = hasContextData ? totalLeads : (hasLegacyData ? filteredDeals.length : 0);
  const finalConversion = hasContextData ? conversionRate : (hasLegacyData && filteredDeals.length > 0 ? (legacyWonDeals.length / filteredDeals.length) * 100 : 0);
  const finalAvgBasket = hasContextData ? avgBasket : (hasLegacyData && legacyWonDeals.length > 0 ? legacyRevenue / legacyWonDeals.length : 0);
  const finalNoShowRate = hasContextData ? noShowRate : 0;
  const finalCommissions = hasContextData ? totalCommissions : (hasLegacyData ? legacyCommissions : 0);
  const finalAvgCommission = hasContextData ? avgCommission : (hasLegacyData && legacyWonDeals.length > 0 ? legacyCommissions / legacyWonDeals.length : 0);
  const finalLostDeals = hasContextData ? lostDeals.length : (hasLegacyData ? legacyLostDeals.length : 0);
  const finalActiveDeals = hasContextData ? activeDeals.length : 0;

  // Debug KPI calculations (with safe property access)
  try {
    // Calculate effective rate for display (commission / revenue)
    const displayRate = finalRevenue > 0 ? (finalCommissions / finalRevenue) * 100 : 0;

    console.log('📈 KPI Calculations (Real-time):', {
      dataSource: hasContextData ? 'ProspectsContext (Primary)' : (hasLegacyData ? 'LocalStorage (Fallback)' : 'None'),
      activeTab: activeTab || 'N/A',
      selectedOfferId: selectedOfferId || 'N/A',
      effectiveCommissionRate: `${displayRate.toFixed(2)}%`,
      totalProspects: allProspects?.length || 0,
      filteredProspects: filteredProspects?.length || 0,
      wonDeals: wonDeals?.length || 0,
      lostDeals: lostDeals?.length || 0,
      activeDeals: activeDeals?.length || 0,
      finalRevenue: finalRevenue || 0,
      finalSales: finalSales || 0,
      finalCommissions: finalCommissions || 0,
      finalConversion: (finalConversion || 0).toFixed(1) + '%',
    });
  } catch (error) {
    console.error('Error logging KPI calculations:', error);
  }

  // Show individual won deals from context
  if (wonDeals.length > 0) {
    console.log('💰 Won deals breakdown (from ProspectsContext):');
    wonDeals.forEach((deal, idx) => {
      console.log(`  ${idx + 1}. ${deal.title || deal.company} - ${deal.value}€`, {
        offerId: deal.offerId,
        offer: deal.offer,
        stage: deal.stage,
        value: deal.value,
      });
    });
  }

  // Format currency
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number): string => {
    return value.toFixed(1);
  };

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
                ? currentDate.toLocaleDateString('fr-FR', {
                    month: 'long',
                    year: 'numeric',
                  })
                : 'Depuis toujours'}
            </p>
            <p className={`text-sm mt-1 ${deals.length > 0 ? 'text-green-400' : 'text-orange-400'}`}>
              Status: {deals.length} deals found (Kanban Mode)
            </p>
          </div>

          <div className="flex flex-col items-end gap-3">
            {/* Month Navigation */}
            {viewMode === 'month' && (
              <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 border border-gray-700">
                <button
                  onClick={prevMonth}
                  className="p-1.5 hover:bg-gray-700 rounded transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-300" />
                </button>
                <span className="text-white font-medium min-w-[140px] text-center capitalize">
                  {currentDate.toLocaleDateString('fr-FR', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
                <button
                  onClick={nextMonth}
                  className="p-1.5 hover:bg-gray-700 rounded transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-gray-300" />
                </button>
              </div>
            )}

            {/* View Mode Toggle */}
            <button
              onClick={() => setViewMode(viewMode === 'month' ? 'all' : 'month')}
              className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              {viewMode === 'month' ? (
                <>
                  <Infinity className="w-4 h-4" />
                  Voir depuis toujours
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4" />
                  Revenir au mois en cours
                </>
              )}
            </button>
          </div>
        </div>

        {/* ALERTE: Aucune donnée - Bouton de secours */}
        {deals.length === 0 && (
          <div className="bg-red-900/20 border-2 border-red-500 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="text-red-500 text-4xl">⚠️</div>
              <div>
                <h3 className="text-red-400 font-bold text-lg">Aucune donnée trouvée</h3>
                <p className="text-gray-300 text-sm mt-1">
                  Le localStorage ne contient aucun deal. Utilisez le bouton ci-dessous pour injecter des données de test.
                </p>
              </div>
            </div>
            <button
              onClick={injectTestData}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-lg hover:shadow-xl whitespace-nowrap"
            >
              🚀 Injecter Données Test
            </button>
          </div>
        )}

        {/* OFFER TABS */}
        <div className="flex gap-2 overflow-x-auto pb-2 border-b border-gray-800">
          <button
            onClick={() => setActiveTab('global')}
            className={`px-4 py-2 rounded-t-lg font-medium transition-all whitespace-nowrap ${
              activeTab === 'global'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Global
          </button>
          {offers.map((offer, idx) => (
            <button
              key={offer.id}
              onClick={() => setActiveTab(offer.name)}
              className={`px-4 py-2 rounded-t-lg font-medium transition-all whitespace-nowrap ${
                activeTab === offer.name
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {offer.name}
            </button>
          ))}
        </div>

        {/* Fallback message when no offers exist */}
        {offers.length === 0 && (
          <div className="bg-yellow-900/20 border border-yellow-500/50 rounded-xl p-6 flex items-center gap-4">
            <div className="text-yellow-500 text-3xl">ℹ️</div>
            <div>
              <h3 className="text-yellow-400 font-bold text-lg">Aucune offre active disponible</h3>
              <p className="text-gray-300 text-sm mt-1">
                Créez une nouvelle offre dans la page <a href="/offers" className="underline text-blue-400 hover:text-blue-300">Offres</a> pour voir des onglets spécifiques ici.
              </p>
            </div>
          </div>
        )}

        {/* KPI CARDS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Revenue */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-green-900/30 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-500" />
              </div>
              <h3 className="text-gray-400 text-sm font-medium">CA Généré</h3>
            </div>
            <p className="text-3xl md:text-4xl font-bold text-white">
              {formatCurrency(finalRevenue)} €
            </p>
          </div>

          {/* Sales */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-900/30 rounded-lg">
                <ShoppingCart className="w-6 h-6 text-blue-500" />
              </div>
              <h3 className="text-gray-400 text-sm font-medium">Ventes</h3>
            </div>
            <p className="text-3xl md:text-4xl font-bold text-white">{finalSales}</p>
          </div>

          {/* Conversion Rate */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-purple-900/30 rounded-lg">
                <Target className="w-6 h-6 text-purple-500" />
              </div>
              <h3 className="text-gray-400 text-sm font-medium">Conversion</h3>
            </div>
            <p className="text-3xl md:text-4xl font-bold text-white">
              {formatPercent(finalConversion)} %
            </p>
          </div>

          {/* Commissions - HIGHLIGHTED WITH BLUE BORDER */}
          <div className="bg-gray-800 rounded-xl p-6 border-2 border-blue-500 hover:border-blue-400 transition-all shadow-lg shadow-blue-500/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-orange-900/30 rounded-lg">
                <Award className="w-6 h-6 text-orange-500" />
              </div>
              <h3 className="text-gray-400 text-sm font-medium">Commissions</h3>
            </div>
            <p className="text-3xl md:text-4xl font-bold text-white">
              {formatCurrency(finalCommissions)} €
            </p>
          </div>

          {/* No Show Rate */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-900/30 rounded-lg">
                <UserX className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-gray-400 text-sm font-medium">Taux de No Show</h3>
            </div>
            <p className="text-3xl md:text-4xl font-bold text-white">
              {finalNoShowRate.toFixed(1)} %
            </p>
          </div>

          {/* Lost Deals */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-900/30 rounded-lg">
                <Ban className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-gray-400 text-sm font-medium">Deals Perdus</h3>
            </div>
            <p className="text-3xl md:text-4xl font-bold text-white">
              {finalLostDeals}
            </p>
          </div>
        </div>

        {/* PERFORMANCE SUMMARY */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-blue-500" />
            Résumé de Performance
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Leads */}
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-900/30 rounded-lg">
                <Users className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Total Leads</p>
                <p className="text-2xl font-bold text-white">{finalLeads}</p>
              </div>
            </div>

            {/* Pipeline Count */}
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-900/30 rounded-lg">
                <Briefcase className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Deals en Pipeline</p>
                <p className="text-2xl font-bold text-white">
                  {finalActiveDeals}
                </p>
              </div>
            </div>

            {/* Average Commission */}
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-900/30 rounded-lg">
                <Award className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Commission Moyenne</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(finalAvgCommission)} €
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* DEBUG SECTION - Shows first Won deal raw data from ProspectsContext */}
        {wonDeals.length > 0 && hasContextData && (
          <div className="bg-gray-800 rounded-xl p-6 border border-yellow-500/50">
            <h3 className="text-yellow-400 font-bold mb-3 flex items-center gap-2">
              🐛 Debug: First "Gagné" Deal (Raw Data)
            </h3>
            <pre className="text-xs text-green-400 overflow-x-auto bg-gray-900 p-4 rounded">
              {JSON.stringify(wonDeals[0], null, 2)}
            </pre>
            <p className="text-gray-400 text-xs mt-2">
              Amount detected: {getDealAmount(wonDeals[0])} €
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
