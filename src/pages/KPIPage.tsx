import { useState, useEffect, useMemo, useCallback } from 'react';
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
  Settings,
  X,
  AlertTriangle,
  Save,
  Plus,
  Trash2
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
import { useAuth } from '../contexts/AuthContext';
import { useUpgrade } from '../contexts/UpgradeContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { supabase } from '../lib/supabase';
import { SharePerformanceButton } from '../components/SharePerformanceButton';
import { Lock } from 'lucide-react';

interface KpiFormulaEntry {
  name: string;
  price: number;
  commission: number;
  sales: number;
}

interface KpiConfigEntry {
  offer_id: number | null;
  planned_calls: number;
  no_shows: number;
  lost_calls: number;
  won_calls: number;
  formulas: KpiFormulaEntry[];
  total_revenue: number;
  total_commission: number;
  mode: 'formulas' | 'manual';
}

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
      } catch (e) { }
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
  const { prospects: salesProspects } = useProspects();
  const { user, isFounder, isAdmin, isInTrial } = useAuth();
  const { showUpgrade } = useUpgrade();
  const { isInOrganization, organization } = useOrganization();
  const hasFullAccess = isFounder || isAdmin || isInTrial;

  // Business hybrid data
  const [bizProspects, setBizProspects] = useState<any[]>([]);
  useEffect(() => {
    if (!isInOrganization || !organization) { setBizProspects([]); return; }
    const fetchBiz = async () => {
      const { data } = await supabase
        .from('business_prospects')
        .select('id, stage, value, contact, company, created_at, assigned_to, assigned_setter')
        .eq('user_id', organization.owner_id)
        .or(`assigned_to.eq.${organization.member_id},assigned_setter.eq.${organization.member_id}`);
      setBizProspects(data || []);
    };
    fetchBiz();
  }, [isInOrganization, organization?.owner_id, organization?.member_id]);

  // Merge Sales + Business prospects
  const allProspects = useMemo(() => {
    if (bizProspects.length === 0) return salesProspects;
    const bizMapped = bizProspects.map(bp => ({
      ...bp,
      stage: bp.stage || 'prospect',
      value: bp.value || 0,
      offer: '',
      offerId: null,
      dateAdded: bp.created_at,
    }));
    return [...salesProspects, ...bizMapped];
  }, [salesProspects, bizProspects]);

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
  const includeInactiveInGlobal = true;

  // --- KPI CONFIG ---
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configTab, setConfigTab] = useState<string>('global');
  const [kpiConfigs, setKpiConfigs] = useState<Record<string, KpiConfigEntry>>({});
  const [savingConfig, setSavingConfig] = useState(false);

  const defaultConfig = (key: string): KpiConfigEntry => ({
    offer_id: key === 'global' ? null : parseInt(key),
    planned_calls: 0, no_shows: 0, lost_calls: 0, won_calls: 0,
    formulas: [], total_revenue: 0, total_commission: 0,
    mode: 'formulas',
  });

  const loadKpiConfig = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.from('kpi_config').select('*').eq('user_id', user.id);
    if (error) { console.error('Erreur chargement kpi_config:', error); return; }
    const configs: Record<string, KpiConfigEntry> = {};
    (data || []).forEach((row: any) => {
      const key = row.offer_id ? String(row.offer_id) : 'global';
      const rawFormulas = Array.isArray(row.formulas) ? row.formulas : [];
      const modeEntry = rawFormulas.find((f: any) => f._mode);
      const actualFormulas = rawFormulas.filter((f: any) => !f._mode);
      configs[key] = {
        offer_id: row.offer_id, planned_calls: row.planned_calls || 0, no_shows: row.no_shows || 0,
        lost_calls: row.lost_calls || 0, won_calls: row.won_calls || 0,
        formulas: actualFormulas,
        total_revenue: row.total_revenue || 0, total_commission: row.total_commission || 0,
        mode: (modeEntry?._mode === 'manual' ? 'manual' : 'formulas') as 'formulas' | 'manual',
      };
    });
    setKpiConfigs(configs);
  }, [user]);

  useEffect(() => { loadKpiConfig(); }, [loadKpiConfig]);

  const saveKpiConfig = async () => {
    if (!user) return;
    setSavingConfig(true);
    try {
      const upsertRows = Object.entries(kpiConfigs).map(([key, entry]) => {
        // Embed mode as metadata in formulas JSONB to avoid needing a DB column
        const formulasWithMode = [...entry.formulas, { _mode: entry.mode || 'formulas' }];
        return {
          user_id: user.id, offer_id: key === 'global' ? null : parseInt(key),
          planned_calls: entry.planned_calls, no_shows: entry.no_shows, lost_calls: entry.lost_calls, won_calls: entry.won_calls,
          formulas: formulasWithMode, total_revenue: entry.total_revenue, total_commission: entry.total_commission,
          updated_at: new Date().toISOString(),
        };
      });
      const { error } = await supabase.from('kpi_config').upsert(upsertRows, { onConflict: 'user_id,offer_id' });
      if (error) throw error;
      setShowConfigModal(false);
    } catch (err) { console.error('Erreur sauvegarde kpi_config:', err); } finally { setSavingConfig(false); }
  };

  const updateConfigField = (key: string, field: keyof KpiConfigEntry, value: number | string) => {
    setKpiConfigs(prev => ({ ...prev, [key]: { ...(prev[key] || defaultConfig(key)), [field]: value } }));
  };

  const getConfigForKey = (key: string): KpiConfigEntry => kpiConfigs[key] || defaultConfig(key);

  const addFormula = (key: string) => {
    setKpiConfigs(prev => {
      const cfg = prev[key] || defaultConfig(key);
      return { ...prev, [key]: { ...cfg, formulas: [...cfg.formulas, { name: '', price: 0, commission: 0, sales: 0 }] } };
    });
  };

  const removeFormula = (key: string, idx: number) => {
    setKpiConfigs(prev => {
      const cfg = prev[key] || defaultConfig(key);
      return { ...prev, [key]: { ...cfg, formulas: cfg.formulas.filter((_, i) => i !== idx) } };
    });
  };

  const updateFormula = (key: string, idx: number, field: keyof KpiFormulaEntry, value: string | number) => {
    setKpiConfigs(prev => {
      const cfg = prev[key] || defaultConfig(key);
      const updated = cfg.formulas.map((f, i) => i === idx ? { ...f, [field]: value } : f);
      return { ...prev, [key]: { ...cfg, formulas: updated } };
    });
  };

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
      const pDate = (prospect.created_at || prospect.dateAdded) ? new Date(prospect.created_at || prospect.dateAdded) : new Date();
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

  // KPI Config pour cartes et graphiques
  const totalKpiConfig = useMemo(() => {
    const total: KpiConfigEntry = { offer_id: null, planned_calls: 0, no_shows: 0, lost_calls: 0, won_calls: 0, formulas: [] as KpiFormulaEntry[], total_revenue: 0, total_commission: 0, mode: 'formulas' };
    Object.values(kpiConfigs).forEach(c => {
      total.planned_calls += c.planned_calls; total.no_shows += c.no_shows; total.lost_calls += c.lost_calls; total.won_calls += c.won_calls;
      total.total_revenue += c.total_revenue; total.total_commission += c.total_commission;
      // Calculer revenu et commission depuis les formules par offre (via ventes par formule, commission en %)
      if (c.mode === 'manual') {
        // manual mode: total_revenue and total_commission already added above
      } else {
        (c.formulas || []).forEach(f => { total.total_revenue += f.price * (f.sales || 0); total.total_commission += (f.price * (f.commission / 100)) * (f.sales || 0); });
      }
    });
    return total;
  }, [kpiConfigs]);

  const activeTabKpiConfig = useMemo((): KpiConfigEntry => {
    if (activeTab === 'global') return totalKpiConfig;
    const targetOffer = allOffers.find(o => o.name === activeTab);
    if (targetOffer) { const config = kpiConfigs[String(targetOffer.id)]; if (config) return config; }
    return defaultConfig('0');
  }, [activeTab, kpiConfigs, totalKpiConfig, allOffers]);

  // Variables affichées dans les cartes (KPI) — incluant la config initiale
  const cfgWon = activeTabKpiConfig.won_calls;
  const cfgLost = activeTabKpiConfig.lost_calls;
  const cfgNoShow = activeTabKpiConfig.no_shows;
  const cfgPlanned = activeTabKpiConfig.planned_calls;

  const baseSales = hasContextData ? ctxSales : legacyWon.length;
  const baseLost = hasContextData ? lostProspects.length : legacyLost.length;
  const baseLeads = hasContextData ? ctxLeads : filteredLegacyDeals.length;
  const baseRevenue = hasContextData ? ctxRevenue : legacyRev;
  const baseCommissions = hasContextData ? ctxCommissions : legacyRev * 0.10;

  const finalSales = baseSales + cfgWon;
  const finalLost = baseLost + cfgLost;
  const finalLeads = baseLeads + cfgPlanned;

  const totalOutcomes = finalSales + finalLost + cfgNoShow;
  const finalConversion = totalOutcomes > 0 ? (finalSales / totalOutcomes) * 100 : (hasContextData ? ctxConversion : legacyConv);
  const finalNoShowRate = totalOutcomes > 0 ? (cfgNoShow + (hasContextData ? noShowProspects.length : 0)) / totalOutcomes * 100 : (hasContextData ? ctxNoShowRate : 0);

  // Calculer le CA et commissions depuis les formules de la config (par ventes par formule, commission en %)
  const cfgRevenue = useMemo(() => {
    if (activeTab === 'global') return activeTabKpiConfig.total_revenue;
    if (activeTabKpiConfig.mode === 'manual') return activeTabKpiConfig.total_revenue;
    return (activeTabKpiConfig.formulas || []).reduce((sum, f) => sum + f.price * (f.sales || 0), 0);
  }, [activeTab, activeTabKpiConfig]);

  const cfgCommission = useMemo(() => {
    if (activeTab === 'global') return activeTabKpiConfig.total_commission;
    if (activeTabKpiConfig.mode === 'manual') return activeTabKpiConfig.total_commission;
    // commission is now a % → (price × commission% / 100) × sales
    return (activeTabKpiConfig.formulas || []).reduce((sum, f) => sum + (f.price * (f.commission / 100)) * (f.sales || 0), 0);
  }, [activeTab, activeTabKpiConfig]);

  const finalRevenue = baseRevenue + cfgRevenue;
  const finalCommissions = baseCommissions + cfgCommission;
  const finalActiveCount = hasContextData ? activeProspects.length : 0;
  const avgCommission = finalSales > 0 ? finalCommissions / finalSales : 0;


  // ==================================================================================
  // 4. CONSTRUCTION DES DONNÉES GRAPHIQUES (Recharts)
  // ==================================================================================

  const chartSourceData = hasContextData ? historicalProspects : historicalLegacyDeals;

  const chartData = useMemo(() => {
    const grouped: Record<string, { won: number; total: number; commission: number; date: Date }> = {};

    chartSourceData.forEach(item => {
      const date = hasContextData
        ? (item.created_at || item.dateAdded ? new Date(item.created_at || item.dateAdded) : new Date())
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

    const result = Object.values(grouped)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(d => ({
        name: d.date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
        closingRate: d.total > 0 ? parseFloat(((d.won / d.total) * 100).toFixed(1)) : 0,
        commission: Math.round(d.commission)
      }));

    // Injecter le point initial KPI config
    if (activeTabKpiConfig.planned_calls > 0 || activeTabKpiConfig.won_calls > 0) {
      const totalClosed = activeTabKpiConfig.won_calls + activeTabKpiConfig.lost_calls;
      const initClosingRate = totalClosed > 0 ? parseFloat(((activeTabKpiConfig.won_calls / totalClosed) * 100).toFixed(1)) : 0;
      result.unshift({ name: '📊 Initial', closingRate: initClosingRate, commission: 0 });
    }

    return result;
  }, [chartSourceData, hasContextData, allOffers, activeTabKpiConfig]);

  return (
    <div className="relative min-h-screen bg-[#111111] p-6 md:px-12 md:pb-20 text-white overflow-hidden">
      {/* Ambient Glows */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto space-y-8 z-10">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pt-4 md:pt-12 pb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-7 h-7 text-emerald-400" />
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tighter">Performance</h1>
            </div>
            <p className="text-white/40 text-sm font-medium">{viewMode === 'month' ? `Analyse pour ${currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}` : 'Analyse approfondie des indicateurs clés de performance'}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {hasFullAccess ? (
              <>
                {viewMode === 'month' && (
                  <div className="flex items-center bg-white/[0.03] rounded-full p-1 border border-white/[0.08]">
                    <button onClick={prevMonth} className="p-2 hover:bg-white/10 rounded-full text-white/60"><ChevronLeft className="w-4 h-4" /></button>
                    <span className="px-4 text-sm font-semibold text-white capitalize min-w-[120px] text-center">{currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span>
                    <button onClick={nextMonth} className="p-2 hover:bg-white/10 rounded-full text-white/60"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                )}
                <button onClick={() => setViewMode(viewMode === 'month' ? 'all' : 'month')} className="px-6 py-2.5 rounded-full bg-white text-black font-semibold hover:bg-white/90 transition-all">
                  {viewMode === 'month' ? 'Vue Globale' : 'Vue Mensuelle'}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/[0.03] border border-white/[0.08] text-sm text-white/40">
                <Lock className="w-4 h-4" />
                Filtres réservés au Pack Pro
              </div>
            )}
            <button
              onClick={() => { setConfigTab(activeOffers.length > 0 ? String(activeOffers[0].id) : 'global'); setShowConfigModal(true); }}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/[0.03] border border-white/[0.08] text-sm font-medium text-white/80 hover:bg-white/10 transition-all"
            >
              <Settings className="w-4 h-4" /> Configurer
            </button>
            <SharePerformanceButton />
          </div>
        </div>

        {/* TABS BAR */}
        <div className="flex gap-1 p-1 bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-full w-fit mb-4">
          <button onClick={() => setActiveTab('global')} className={`px-8 py-2 rounded-full text-sm font-bold transition-all ${activeTab === 'global' ? 'bg-emerald-500 text-black' : 'text-white/40 hover:text-white'}`}>Global</button>
          {activeOffers.map((offer) => (
            <button key={offer.id} onClick={() => setActiveTab(offer.name)} className={`px-8 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap ${activeTab === offer.name ? 'bg-emerald-500 text-black' : 'text-white/40 hover:text-white'}`}>{offer.name}</button>
          ))}
          {inactiveOffers.length > 0 && (
            <div className="relative group">
              <select value={inactiveOffers.some(o => o.name === activeTab) ? activeTab : "archives"} onChange={(e) => setActiveTab(e.target.value)} className={`appearance-none pl-10 pr-8 py-2 rounded-full text-sm font-bold border-none cursor-pointer outline-none bg-transparent ${inactiveOffers.some(o => o.name === activeTab) ? 'text-white' : 'text-white/40 hover:text-white'}`}>
                <option value="archives" disabled hidden>Archives ({inactiveOffers.length})</option>
                {inactiveOffers.map(o => <option key={o.id} value={o.name} className="bg-[#1a1a1a]">📦 {o.name}</option>)}
              </select>
              <Archive className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${inactiveOffers.some(o => o.name === activeTab) ? 'text-white' : 'text-white/40'}`} />
            </div>
          )}
        </div>

        {/* CARDS KPI */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          <KpiCard title="CA Généré" value={`${formatCurrency(finalRevenue)} €`} icon={DollarSign} color="emerald" glow />
          <KpiCard title="Ventes Totales" value={finalSales.toString()} icon={ShoppingCart} color="blue" />
          <KpiCard title="Taux de Conversion" value={`${formatPercent(finalConversion)} %`} icon={Target} color="purple" />
          <KpiCard title="Mes Commissions" value={`${formatCurrency(finalCommissions)} €`} icon={Award} color="amber" glow />
          <KpiCard title="Taux de No Show" value={`${finalNoShowRate.toFixed(1)} %`} icon={UserX} color="rose" />
          <KpiCard title="Deals Perdus" value={finalLost.toString()} icon={Ban} color="slate" />
        </div>

        {/* GRAPHIQUES RECHARTS */}
        <div className="relative">
          {!hasFullAccess && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl">
              <button
                onClick={showUpgrade}
                className="flex items-center gap-2.5 px-8 py-4 rounded-full bg-emerald-500 text-black font-bold text-base shadow-2xl shadow-emerald-500/20 hover:bg-emerald-400 active:scale-[0.98] transition-all"
              >
                <Lock className="w-5 h-5" />
                Débloquer
              </button>
            </div>
          )}
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-8 ${!hasFullAccess ? 'blur-md select-none pointer-events-none' : ''}`}>

          <div className="rounded-2xl p-8 bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-lg font-bold text-white">Historique Taux de Closing</h3>
              <span className="text-xs font-medium text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full">Moyenne {chartData.length > 0 ? (chartData.reduce((s, d) => s + d.closingRate, 0) / chartData.length).toFixed(1) : '0'}%</span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorClosing" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} unit="%" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: '#fff' }}
                    itemStyle={{ color: '#a855f7' }}
                  />
                  <Area type="monotone" dataKey="closingRate" stroke="#a855f7" strokeWidth={2} fillOpacity={1} fill="url(#colorClosing)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl p-8 bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-lg font-bold text-white">Historique Commissions</h3>
              <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full">Performance</span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorCommissions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: '#fff' }}
                    itemStyle={{ color: '#10b981' }}
                    formatter={(value: number) => [`${value} €`, 'Commission']}
                  />
                  <Area type="monotone" dataKey="commission" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorCommissions)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          </div>
        </div>

        {/* SUMMARY */}
        <div className="rounded-2xl bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] shadow-[0_20px_40px_rgba(0,0,0,0.2)] overflow-hidden">
          <div className="bg-white/5 px-8 py-4 border-b border-white/5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white/60">Vue d'ensemble Pipeline</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/5">
            <SummaryItem label="Total Leads Traités" value={finalLeads} icon={Users} color="blue" />
            <SummaryItem label="Deals en Cours" value={finalActiveCount} icon={Briefcase} color="emerald" />
            <SummaryItem label="Commission Moy." value={`${formatCurrency(avgCommission)} €`} icon={Award} color="amber" />
          </div>
        </div>

        {/* MODAL CONFIGURER MES KPI */}
        {showConfigModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setShowConfigModal(false)} />
            <div className="relative w-full max-w-xl mx-4 bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-2xl overflow-hidden">

              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-600/20 rounded-lg border border-blue-500/30">
                    <Settings className="w-5 h-5 text-blue-400" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Configurer mes KPI</h2>
                </div>
                <button onClick={() => setShowConfigModal(false)} className="p-2 rounded-lg text-white/40 hover:bg-white/5 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Warning */}
              <div className="mx-6 mt-4 flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <p className="text-sm text-amber-300">Merci de créer vos différentes offres tout d'abord</p>
              </div>

              {/* Recommendation */}
              <p className="mx-6 mt-3 text-xs text-white/40 italic">💡 Il est recommandé de commencer par remplir les offres avant l'onglet Global.</p>

              {/* Tabs */}
              <div className="flex items-center gap-2 px-6 mt-4 overflow-x-auto pb-2 scrollbar-hide">
                {allOffers.map((offer) => (
                  <button
                    key={offer.id}
                    onClick={() => setConfigTab(String(offer.id))}
                    className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${configTab === String(offer.id) ? 'bg-gradient-to-r from-emerald-600 to-teal-600 border-emerald-500/50 text-white shadow-lg' : 'bg-white/[0.03] border-transparent text-white/40 hover:bg-white/5 hover:text-white'}`}
                  >
                    {offer.name}
                  </button>
                ))}
                <button
                  onClick={() => setConfigTab('global')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${configTab === 'global' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 border-blue-500/50 text-white shadow-lg' : 'bg-white/[0.03] border-transparent text-white/40 hover:bg-white/5 hover:text-white'}`}
                >
                  Global
                </button>
              </div>

              {/* Form */}
              <div className="p-6 space-y-4 max-h-[50vh] overflow-y-auto">
                {configTab === 'global' && (
                  <p className="text-xs text-white/40 bg-white/[0.03] rounded-lg px-3 py-2 border border-white/[0.08]">
                    📌 Saisissez les chiffres <span className="font-semibold text-white">hors offres déjà inscrites</span> ci-dessus.
                  </p>
                )}

                {/* Call fields — both offer and global tabs */}
                {(() => {
                  const config = getConfigForKey(configTab);
                  const fields: { key: keyof KpiConfigEntry; label: string; icon: string; color: string }[] = [
                    { key: 'planned_calls', label: 'Combien de calls prévus initialement ?', icon: '📞', color: 'border-blue-500/30 focus:border-blue-500' },
                    { key: 'no_shows', label: 'Combien de no show ?', icon: '👻', color: 'border-rose-500/30 focus:border-rose-500' },
                    { key: 'lost_calls', label: 'Combien de calls perdus ?', icon: '❌', color: 'border-red-500/30 focus:border-red-500' },
                    { key: 'won_calls', label: 'Combien de calls gagnés ?', icon: '✅', color: 'border-emerald-500/30 focus:border-emerald-500' },
                  ];
                  return fields.map(f => (
                    <div key={f.key}>
                      <label className="flex items-center gap-2 text-sm font-medium text-white/60 mb-1.5">
                        <span>{f.icon}</span> {f.label}
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={config[f.key] as number}
                        onChange={(e) => updateConfigField(configTab, f.key, parseInt(e.target.value) || 0)}
                        className={`w-full rounded-lg border bg-white/5 px-4 py-2.5 text-sm text-white focus:outline-none ${f.color}`}
                      />
                    </div>
                  ));
                })()}

                {/* OFFER TABS: Mode switch + content */}
                {configTab !== 'global' && (() => {
                  const cfgMode = getConfigForKey(configTab).mode || 'formulas';
                  return (
                    <div className="mt-4 space-y-4">
                      {/* Mode switch */}
                      <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/5">
                        <button
                          onClick={() => updateConfigField(configTab, 'mode', 'formulas')}
                          className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all ${cfgMode === 'formulas' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                        >
                          📊 Calcul auto (formules)
                        </button>
                        <button
                          onClick={() => updateConfigField(configTab, 'mode', 'manual')}
                          className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all ${cfgMode === 'manual' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                        >
                          ✍️ Saisie manuelle
                        </button>
                      </div>

                      {/* Formula mode */}
                      {cfgMode === 'formulas' && (
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-white">📋 Formules</h4>
                            <button
                              onClick={() => addFormula(configTab)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-xs font-medium text-emerald-400 hover:bg-emerald-600/30 transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" /> Ajouter
                            </button>
                          </div>

                          {getConfigForKey(configTab).formulas.length === 0 && (
                            <p className="text-xs text-white/40 italic">Aucune formule. Cliquez sur "Ajouter" pour en créer une.</p>
                          )}

                          {getConfigForKey(configTab).formulas.map((formula, idx) => (
                            <div key={idx} className="rounded-lg border border-white/5 bg-white/[0.03] p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-white/40">Formule {idx + 1}</span>
                                <button
                                  onClick={() => removeFormula(configTab, idx)}
                                  className="p-1 rounded text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <div>
                                <label className="text-xs text-white/40 mb-1 block">Nom</label>
                                <input
                                  type="text"
                                  value={formula.name}
                                  onChange={(e) => updateFormula(configTab, idx, 'name', e.target.value)}
                                  placeholder="Ex: Formule Gold"
                                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                />
                              </div>
                              <div className="grid grid-cols-3 gap-3">
                                <div>
                                  <label className="text-xs text-white/40 mb-1 block">💰 Prix (€)</label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={formula.price}
                                    onChange={(e) => updateFormula(configTab, idx, 'price', parseFloat(e.target.value) || 0)}
                                    className="w-full rounded-lg border border-amber-500/30 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-white/40 mb-1 block">🏆 Commission (%)</label>
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={formula.commission}
                                    onChange={(e) => updateFormula(configTab, idx, 'commission', parseFloat(e.target.value) || 0)}
                                    className="w-full rounded-lg border border-emerald-500/30 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-white/40 mb-1 block">📊 Ventes</label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={formula.sales || 0}
                                    onChange={(e) => updateFormula(configTab, idx, 'sales', parseInt(e.target.value) || 0)}
                                    className="w-full rounded-lg border border-blue-500/30 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                  />
                                </div>
                              </div>
                              {/* Auto-calculated commission preview */}
                              {(formula.sales || 0) > 0 && formula.price > 0 && formula.commission > 0 && (
                                <div className="text-xs text-emerald-400/80 bg-emerald-500/10 rounded-lg px-3 py-1.5 border border-emerald-500/20">
                                  💡 Commission calculée : <span className="font-bold">{((formula.price * (formula.commission / 100)) * (formula.sales || 0)).toLocaleString('fr-FR')} €</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Manual mode */}
                      {cfgMode === 'manual' && (
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                          <h4 className="text-sm font-bold text-white">💶 Revenus initiaux</h4>
                          <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-white/60 mb-1.5">
                              <span>💰</span> CA Généré (€)
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={getConfigForKey(configTab).total_revenue}
                              onChange={(e) => updateConfigField(configTab, 'total_revenue', parseFloat(e.target.value) || 0)}
                              className="w-full rounded-lg border border-emerald-500/30 bg-white/5 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                          <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-white/60 mb-1.5">
                              <span>🏆</span> Commission touchée (€)
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={getConfigForKey(configTab).total_commission}
                              onChange={(e) => updateConfigField(configTab, 'total_commission', parseFloat(e.target.value) || 0)}
                              className="w-full rounded-lg border border-amber-500/30 bg-white/5 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* GLOBAL TAB: Commission & CA */}
                {configTab === 'global' && (
                  <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                    <h4 className="text-sm font-bold text-white">💶 Revenus initiaux</h4>
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-white/60 mb-1.5">
                        <span>💰</span> CA Généré (€)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={getConfigForKey('global').total_revenue}
                        onChange={(e) => updateConfigField('global', 'total_revenue', parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border border-emerald-500/30 bg-white/5 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-white/60 mb-1.5">
                        <span>🏆</span> Commission touchée (€)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={getConfigForKey('global').total_commission}
                        onChange={(e) => updateConfigField('global', 'total_commission', parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border border-amber-500/30 bg-white/5 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 pb-6">
                <button onClick={() => setShowConfigModal(false)} className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/40 hover:text-white transition-colors">
                  Annuler
                </button>
                <button
                  onClick={saveKpiConfig}
                  disabled={savingConfig}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-sm font-bold text-white hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {savingConfig ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

const KpiCard = ({ title, value, icon: Icon, color, glow }: any) => {
  const textColors: any = {
    emerald: 'text-emerald-500',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    amber: 'text-amber-400',
    rose: 'text-rose-500',
    slate: 'text-white/40',
  };
  const glowStyles: any = {
    emerald: 'shadow-[0_0_20px_rgba(16,185,129,0.1)]',
    amber: 'shadow-[0_0_25px_rgba(245,158,11,0.15)] bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/20',
  };
  return (
    <div className={`relative p-8 rounded-2xl bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] transition-all hover:bg-white/5 group ${glow ? glowStyles[color] || '' : ''}`}>
      {glow && color === 'amber' && <div className="absolute -right-4 -top-4 h-24 w-24 bg-amber-500/10 blur-3xl group-hover:bg-amber-500/20 transition-all" />}
      <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4">{title}</p>
      <h3 className={`text-3xl font-extrabold tracking-tight ${glow ? textColors[color] : 'text-white'}`}>{value}</h3>
    </div>
  );
};

const SummaryItem = ({ label, value, icon: Icon, color }: any) => {
  const colors: any = { blue: 'text-blue-400 bg-blue-500/10', emerald: 'text-emerald-400 bg-emerald-500/10', amber: 'text-amber-400 bg-amber-500/10' };
  return (
    <div className="p-8 flex items-center gap-6">
      <div className={`h-12 w-12 rounded-full flex items-center justify-center ${colors[color] || colors.blue}`}><Icon className="w-6 h-6" /></div>
      <div><p className="text-xs text-white/40 font-medium uppercase tracking-widest">{label}</p><p className="text-2xl font-bold text-white">{value}</p></div>
    </div>
  );
};