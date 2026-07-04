import { useState, useEffect, useRef } from 'react';
import { X, Check, ExternalLink, Loader2, RefreshCw, Link as LinkIcon, Copy, Info, ChevronDown, Key, Trash2, Zap, Eye, EyeOff, CalendarDays, Save, Download, Upload, FileSpreadsheet, AlertTriangle, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBusinessAuth } from '../contexts/BusinessAuthContext';
import { useBusinessLang } from '../i18n/BusinessLangContext'
import { useBusinessProspects } from '../contexts/BusinessProspectsContext';
import { supabase } from '../../lib/supabase';
import { BusinessCRMAutoAssignBlock } from './BusinessCRMAutoAssignBlock';

const CRM_OPTIONS = [
  { id: 'closeos', name: 'CloseOS CRM', description: 'CRM intégré CloseOS', color: 'bg-amber-500', textColor: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-300', iconBg: 'bg-[#1b1c1b]', iconText: 'text-white', logo: '/closeos-crm.png' },
  { id: 'iclosed', name: 'iClosed', description: 'Connectez via Webhook', color: 'bg-purple-500', textColor: 'text-purple-700', bgColor: 'bg-purple-50', borderColor: 'border-purple-300', iconBg: 'bg-emerald-100', iconText: 'text-emerald-700', logo: '/Iclosed.png' },
  { id: 'hubspot', name: 'HubSpot', description: 'Synchronisez avec HubSpot CRM', color: 'bg-orange-500', textColor: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-300', iconBg: 'bg-[#ff7a59]', iconText: 'text-white', logo: '/HubSpot.png' },
  { id: 'pipedrive', name: 'Pipedrive', description: 'Connectez votre pipeline Pipedrive', color: 'bg-green-500', textColor: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-300', iconBg: 'bg-[#222222]', iconText: 'text-white', logo: '/Pipedrive.png' },
  { id: 'systemeio', name: 'Systeme.io', description: 'Importez vos contacts Systeme.io', color: 'bg-blue-500', textColor: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-300', iconBg: 'bg-[#00a1d4]', iconText: 'text-white', logo: '/Systemeio.png' },
  { id: 'zapier', name: 'Zapier', description: 'Importez des prospects via Zapier (webhook)', color: 'bg-[#FF4A00]', textColor: 'text-[#FF4A00]', bgColor: 'bg-orange-50', borderColor: 'border-orange-300', iconBg: 'bg-[#ff4a00]', iconText: 'text-white', logo: '/Zapier.png' },
  { id: 'make', name: 'Make', description: 'Automatisez avec Make (ex-Integromat)', color: 'bg-[#6D00CC]', textColor: 'text-[#6D00CC]', bgColor: 'bg-purple-50', borderColor: 'border-purple-300', iconBg: 'bg-[#6d00cc]', iconText: 'text-white', logo: '/make.png' },
  { id: 'n8n', name: 'n8n', description: 'Automatisez avec n8n (open-source)', color: 'bg-[#EA4B71]', textColor: 'text-[#EA4B71]', bgColor: 'bg-pink-50', borderColor: 'border-pink-300', iconBg: 'bg-[#EA4B71]', iconText: 'text-white', logo: '/N8N.png' },
  { id: 'calendly', name: 'Calendly', description: 'Importez les RDV Calendly automatiquement', color: 'bg-[#006BFF]', textColor: 'text-[#006BFF]', bgColor: 'bg-blue-50', borderColor: 'border-blue-300', iconBg: 'bg-[#006bff]', iconText: 'text-white', logo: '/Calendly.png' },
  { id: 'airtable', name: 'Airtable', description: 'Synchronisez avec votre base Airtable', color: 'bg-[#18BFFF]', textColor: 'text-[#18BFFF]', bgColor: 'bg-cyan-50', borderColor: 'border-cyan-300', iconBg: 'bg-[#18bfff]', iconText: 'text-white', logo: '/airtable.png' },
  { id: 'ghl', name: 'GoHighLevel', description: 'Synchronisez avec GoHighLevel', color: 'bg-[#FF6B35]', textColor: 'text-[#FF6B35]', bgColor: 'bg-orange-50', borderColor: 'border-orange-300', iconBg: 'bg-[#FF6B35]', iconText: 'text-white', logo: '/GHL.jpg' },
  { id: 'csv', name: 'CSV', description: 'Importez / Exportez vos prospects en CSV', color: 'bg-emerald-500', textColor: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-300', iconBg: 'bg-[#047857]', iconText: 'text-white', logo: '/LogoCSV.png' },
];

const CLOSEOS_STAGES = [
  { id: 'prospect', name: 'Prospect' },
  { id: 'contacted', name: 'Contacté' },
  { id: 'qualified', name: 'Qualifié' },
  { id: 'won', name: 'Gagné' },
  { id: 'followup', name: 'Follow Up' },
  { id: 'noshow', name: 'No Show' },
  { id: 'lost', name: 'Perdu' },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function BusinessCRMIntegrationModal({ isOpen, onClose }: Props) {
  const { user, businessSettings, updateBusinessSettings, hasApiAccess } = useBusinessAuth();
  const { t, lang } = useBusinessLang()
  const { prospects, addProspect, syncHubspot, syncPipedrive, syncAirtable, syncGhl, isSyncingHubspot, isSyncingPipedrive, isSyncingAirtable, isSyncingGhl, hubspotConnected, pipedriveConnected, airtableConnected, ghlConnected } = useBusinessProspects();

  const [selected, setSelected] = useState(businessSettings?.crm_provider || 'closeos');
  const [saving, setSaving] = useState(false);
  const [syncResult, setSyncResult] = useState<{ imported: number; updated: number } | null>(null);

  // iClosed webhook
  const [iclosedApiKey, setIclosedApiKey] = useState<string | null>(null);
  const [iclosedKeyId, setIclosedKeyId] = useState<string | null>(null);
  const [iclosedLoading, setIclosedLoading] = useState(false);
  const [iclosedCopiedUrl, setIclosedCopiedUrl] = useState(false);
  const [iclosedCopiedKey, setIclosedCopiedKey] = useState(false);
  const [iclosedShowKey, setIclosedShowKey] = useState(false);
  // iClosed custom stage mapping (iClosed stage name → CloseOS stage)
  const [iclosedMappings, setIclosedMappings] = useState<Array<{ name: string; stage: string }>>([]);
  const [iclosedMappingSaving, setIclosedMappingSaving] = useState(false);

  // iClosed outbound push key (the user's iClosed Bearer key — different from
  // the inbound webhook key generated above). Stored in business_settings.iclosed_api_key.
  const [iclosedPushKey, setIclosedPushKey] = useState<string>('');
  const [iclosedPushKeySaving, setIclosedPushKeySaving] = useState(false);
  const [iclosedPushKeyTesting, setIclosedPushKeyTesting] = useState(false);
  const [iclosedPushShowKey, setIclosedPushShowKey] = useState(false);

  // Pipedrive mapping
  const [pipedrivePipelines, setPipedrivePipelines] = useState<any[]>([]);
  const [pipedriveStages, setPipedriveStages] = useState<any[]>([]);
  const [pipedriveMappings, setPipedriveMappings] = useState<Record<string, number>>({});
  const [loadingPipelines, setLoadingPipelines] = useState(false);

  // Zapier
  const [zapierApiKey, setZapierApiKey] = useState<string | null>(null);
  const [zapierKeyId, setZapierKeyId] = useState<string | null>(null);
  const [zapierLoading, setZapierLoading] = useState(false);
  const [zapierCopiedUrl, setZapierCopiedUrl] = useState(false);
  const [zapierCopiedKey, setZapierCopiedKey] = useState(false);
  const [zapierShowKey, setZapierShowKey] = useState(false);

  // Make
  const [makeApiKey, setMakeApiKey] = useState<string | null>(null);
  const [makeKeyId, setMakeKeyId] = useState<string | null>(null);
  const [makeLoading, setMakeLoading] = useState(false);
  const [makeCopiedUrl, setMakeCopiedUrl] = useState(false);
  const [makeCopiedKey, setMakeCopiedKey] = useState(false);
  const [makeShowKey, setMakeShowKey] = useState(false);

  // n8n
  const [n8nApiKey, setN8nApiKey] = useState<string | null>(null);
  const [n8nKeyId, setN8nKeyId] = useState<string | null>(null);
  const [n8nLoading, setN8nLoading] = useState(false);
  const [n8nCopiedUrl, setN8nCopiedUrl] = useState(false);
  const [n8nCopiedKey, setN8nCopiedKey] = useState(false);
  const [n8nShowKey, setN8nShowKey] = useState(false);

  // Systeme.io
  const [systemeioApiKey, setSystemeioApiKey] = useState('');
  const [systemeioSaving, setSystemeioSaving] = useState(false);
  const [systemeioCopiedUrl, setSystemeioCopiedUrl] = useState(false);
  const [systemeioShowKey, setSystemeioShowKey] = useState(false);

  // Calendly
  const [calendlyApiKey, setCalendlyApiKey] = useState<string | null>(null);
  const [calendlyKeyId, setCalendlyKeyId] = useState<string | null>(null);
  const [calendlyLoading, setCalendlyLoading] = useState(false);
  const [calendlyCopiedUrl, setCalendlyCopiedUrl] = useState(false);
  const [calendlyCopiedKey, setCalendlyCopiedKey] = useState(false);
  const [calendlyShowKey, setCalendlyShowKey] = useState(false);

  // Airtable
  const [airtableBases, setAirtableBases] = useState<{ id: string; name: string }[]>([]);
  const [airtableTables, setAirtableTables] = useState<{ id: string; name: string }[]>([]);
  const [airtableFields, setAirtableFields] = useState<{ id: string; name: string; type: string }[]>([]);
  const [airtableBaseId, setAirtableBaseId] = useState('');
  const [airtableTableId, setAirtableTableId] = useState('');
  const [airtableFieldMapping, setAirtableFieldMapping] = useState<Record<string, string>>({});
  const [airtableStageMapping, setAirtableStageMapping] = useState<Record<string, string>>({});
  const [airtableLoadingBases, setAirtableLoadingBases] = useState(false);
  const [airtableLoadingTables, setAirtableLoadingTables] = useState(false);
  const [airtableLoadingFields, setAirtableLoadingFields] = useState(false);
  const [airtableSavingConfig, setAirtableSavingConfig] = useState(false);

  // CSV
  const csvFileRef = useRef<HTMLInputElement>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<{ imported: number; skipped: number; defaulted: number } | null>(null);
  const [csvPromptCopied, setCsvPromptCopied] = useState(false);

  // GHL
  const [ghlPipelines, setGhlPipelines] = useState<any[]>([]);
  const [ghlStages, setGhlStages] = useState<any[]>([]);
  const [ghlSelectedPipeline, setGhlSelectedPipeline] = useState('');
  const [ghlMappings, setGhlMappings] = useState<Record<string, string>>({});
  const [ghlLoadingPipelines, setGhlLoadingPipelines] = useState(false);
  const [ghlSavingConfig, setGhlSavingConfig] = useState(false);

  // ─── CloseOS CRM tab state ───────────────────────────────────────────────
  const [closeosKeys, setCloseosKeys] = useState<any[]>([]);
  const [closeosSubs, setCloseosSubs] = useState<any[]>([]);
  const [closeosNewKeyName, setCloseosNewKeyName] = useState('API CloseOS');
  const [closeosNewSubUrl, setCloseosNewSubUrl] = useState('');
  const [closeosNewSubEvents, setCloseosNewSubEvents] = useState<string[]>(['prospect.created']);
  const [closeosCreatingKey, setCloseosCreatingKey] = useState(false);
  const [closeosCreatingSub, setCloseosCreatingSub] = useState(false);
  const [closeosShowKey, setCloseosShowKey] = useState<Record<string, boolean>>({});
  const [closeosShowSecret, setCloseosShowSecret] = useState<Record<string, boolean>>({});
  const [closeosCopiedKey, setCloseosCopiedKey] = useState<string | null>(null);
  const [closeosCopiedSecret, setCloseosCopiedSecret] = useState<string | null>(null);
  const [closeosCopiedCurl, setCloseosCopiedCurl] = useState(false);
  const [closeosTesting, setCloseosTesting] = useState<string | null>(null);

  useEffect(() => {
    if (businessSettings?.crm_provider) {
      setSelected(businessSettings.crm_provider);
    }
  }, [businessSettings?.crm_provider]);

  // Load Pipedrive pipelines when selected and connected
  useEffect(() => {
    if (selected !== 'pipedrive' || !pipedriveConnected || !user || !isOpen) return;
    const load = async () => {
      setLoadingPipelines(true);
      try {
        const res = await fetch(`/api/business-crm-sync?action=pipedrive-pipelines&user_id=${user.id}`);
        if (res.ok) {
          const data = await res.json();
          setPipedrivePipelines(data.pipelines || []);
          setPipedriveStages(data.stages || []);
        }
      } catch (err) {
        console.error('Error loading Pipedrive pipelines:', err);
      } finally {
        setLoadingPipelines(false);
      }
    };
    load();
  }, [selected, pipedriveConnected, user, isOpen]);

  // Load existing Pipedrive mappings
  useEffect(() => {
    if (selected !== 'pipedrive' || !user || !isOpen) return;
    const load = async () => {
      const { data } = await supabase
        .from('pipedrive_stage_mapping')
        .select('*')
        .eq('user_id', user.id);
      if (data) {
        const m: Record<string, number> = {};
        data.forEach((row: any) => m[row.closeos_stage] = row.pipedrive_stage_id);
        setPipedriveMappings(m);
      }
    };
    load();
  }, [selected, user, isOpen]);

  // Load Systeme.io API key
  useEffect(() => {
    if (selected !== 'systemeio' || !user || !isOpen) return;
    const load = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('systemeio_api_key')
        .eq('id', user.id)
        .maybeSingle();
      setSystemeioApiKey(data?.systemeio_api_key || '');
    };
    load();
  }, [selected, user, isOpen]);

  const handleSaveSystemeioKey = async () => {
    if (!user) return;
    setSystemeioSaving(true);
    try {
      await supabase
        .from('profiles')
        .update({ systemeio_api_key: systemeioApiKey || null })
        .eq('id', user.id);
    } catch (err) {
      console.error('Error saving Systeme.io key:', err);
    } finally {
      setSystemeioSaving(false);
    }
  };

  // Load existing Zapier API key
  useEffect(() => {
    if (selected !== 'zapier' || !user || !isOpen) return;
    const load = async () => {
      const ownerUserId = user.id;
      const { data } = await supabase
        .from('business_webhook_keys')
        .select('id, api_key')
        .eq('user_id', ownerUserId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (data) {
        setZapierApiKey(data.api_key);
        setZapierKeyId(data.id);
      } else {
        setZapierApiKey(null);
        setZapierKeyId(null);
      }
    };
    load();
  }, [selected, user, isOpen]);

  // Load existing Make API key
  useEffect(() => {
    if (selected !== 'make' || !user || !isOpen) return;
    const load = async () => {
      const { data } = await supabase
        .from('business_webhook_keys')
        .select('id, api_key')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .eq('name', 'Make')
        .limit(1)
        .maybeSingle();
      if (data) {
        setMakeApiKey(data.api_key);
        setMakeKeyId(data.id);
      } else {
        setMakeApiKey(null);
        setMakeKeyId(null);
      }
    };
    load();
  }, [selected, user, isOpen]);

  // Load existing n8n API key
  useEffect(() => {
    if (selected !== 'n8n' || !user || !isOpen) return;
    const load = async () => {
      const { data } = await supabase
        .from('business_webhook_keys')
        .select('id, api_key')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .eq('name', 'n8n')
        .limit(1)
        .maybeSingle();
      if (data) {
        setN8nApiKey(data.api_key);
        setN8nKeyId(data.id);
      } else {
        setN8nApiKey(null);
        setN8nKeyId(null);
      }
    };
    load();
  }, [selected, user, isOpen]);

  // Load existing Calendly API key
  useEffect(() => {
    if (selected !== 'calendly' || !user || !isOpen) return;
    const load = async () => {
      const { data } = await supabase
        .from('business_webhook_keys')
        .select('id, api_key')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .eq('name', 'Calendly')
        .limit(1)
        .maybeSingle();
      if (data) {
        setCalendlyApiKey(data.api_key);
        setCalendlyKeyId(data.id);
      } else {
        setCalendlyApiKey(null);
        setCalendlyKeyId(null);
      }
    };
    load();
  }, [selected, user, isOpen]);

  // Load existing iClosed API key
  useEffect(() => {
    if (selected !== 'iclosed' || !user || !isOpen) return;
    const load = async () => {
      const { data } = await supabase
        .from('business_webhook_keys')
        .select('id, api_key')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .eq('name', 'iClosed')
        .limit(1)
        .maybeSingle();
      if (data) {
        setIclosedApiKey(data.api_key);
        setIclosedKeyId(data.id);
      } else {
        setIclosedApiKey(null);
        setIclosedKeyId(null);
      }
    };
    load();
  }, [selected, user, isOpen]);

  // Load existing iClosed custom stage mapping
  useEffect(() => {
    if (selected !== 'iclosed' || !isOpen) return;
    const raw = (businessSettings as any)?.iclosed_stage_mapping;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const list = Object.entries(raw).map(([name, stage]) => ({ name, stage: String(stage) }));
      setIclosedMappings(list);
    } else {
      setIclosedMappings([]);
    }
  }, [selected, isOpen, businessSettings]);

  // Load existing iClosed push (outbound) API key
  useEffect(() => {
    if (selected !== 'iclosed' || !isOpen) return;
    const raw = (businessSettings as any)?.iclosed_api_key;
    setIclosedPushKey(typeof raw === 'string' ? raw : '');
  }, [selected, isOpen, businessSettings]);

  // ─── CloseOS CRM tab: load API keys + outbound subscriptions ──────────────
  const refreshCloseosKeysAndSubs = async () => {
    if (!user) return;
    const [keysRes, subsRes] = await Promise.all([
      supabase.from('business_webhook_keys').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('business_webhook_subscriptions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]);
    setCloseosKeys(keysRes.data || []);
    setCloseosSubs(subsRes.data || []);
  };

  useEffect(() => {
    if (selected !== 'closeos' || !user || !isOpen) return;
    refreshCloseosKeysAndSubs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, user, isOpen]);

  // Load existing Airtable config
  useEffect(() => {
    if (selected !== 'airtable' || !user || !isOpen) return;
    const config = businessSettings?.airtable_config;
    if (config) {
      setAirtableBaseId(config.baseId || '');
      setAirtableTableId(config.tableId || '');
      setAirtableFieldMapping(config.fieldMapping || {});
      setAirtableStageMapping(config.stageMapping || {});
    }
  }, [selected, user, isOpen, businessSettings?.airtable_config]);

  // Load Airtable bases when connected
  useEffect(() => {
    if (selected !== 'airtable' || !airtableConnected || !user || !isOpen) return;
    const load = async () => {
      setAirtableLoadingBases(true);
      try {
        const res = await fetch('/api/business-crm-sync?action=airtable-bases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id }),
        });
        if (res.ok) {
          const data = await res.json();
          setAirtableBases(data.bases || []);
        }
      } catch (err) {
        console.error('Error loading Airtable bases:', err);
      } finally {
        setAirtableLoadingBases(false);
      }
    };
    load();
  }, [selected, airtableConnected, user, isOpen]);

  // Load Airtable tables when base selected
  useEffect(() => {
    if (!airtableBaseId || !airtableConnected || !user) return;
    const load = async () => {
      setAirtableLoadingTables(true);
      try {
        const res = await fetch('/api/business-crm-sync?action=airtable-tables', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, base_id: airtableBaseId }),
        });
        if (res.ok) {
          const data = await res.json();
          setAirtableTables(data.tables || []);
        }
      } catch (err) {
        console.error('Error loading Airtable tables:', err);
      } finally {
        setAirtableLoadingTables(false);
      }
    };
    load();
  }, [airtableBaseId, airtableConnected, user, isOpen]);

  // Load Airtable fields when table selected
  useEffect(() => {
    if (!airtableBaseId || !airtableTableId || !airtableConnected || !user) return;
    const load = async () => {
      setAirtableLoadingFields(true);
      try {
        const res = await fetch('/api/business-crm-sync?action=airtable-fields', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, base_id: airtableBaseId, table_id: airtableTableId }),
        });
        if (res.ok) {
          const data = await res.json();
          setAirtableFields(data.fields || []);
        }
      } catch (err) {
        console.error('Error loading Airtable fields:', err);
      } finally {
        setAirtableLoadingFields(false);
      }
    };
    load();
  }, [airtableBaseId, airtableTableId, airtableConnected, user, isOpen]);

  // Load GHL pipelines when selected and connected
  useEffect(() => {
    if (selected !== 'ghl' || !ghlConnected || !user || !isOpen) return;
    const load = async () => {
      setGhlLoadingPipelines(true);
      try {
        const res = await fetch(`/api/business-crm-sync?action=ghl-pipelines&user_id=${user.id}`);
        if (res.ok) {
          const data = await res.json();
          setGhlPipelines(data.pipelines || []);
          setGhlStages(data.stages || []);
        }
      } catch (err) {
        console.error('Error loading GHL pipelines:', err);
      } finally {
        setGhlLoadingPipelines(false);
      }
    };
    load();
  }, [selected, ghlConnected, user, isOpen]);

  // Load existing GHL config
  useEffect(() => {
    if (selected !== 'ghl' || !user || !isOpen) return;
    const config = businessSettings?.ghl_config;
    if (config) {
      setGhlSelectedPipeline(config.pipelineId || '');
      setGhlMappings(config.stageMapping || {});
    }
  }, [selected, user, isOpen, businessSettings?.ghl_config]);

  const handleConnectGhl = () => {
    const clientId = process.env.GHL_CLIENT_ID || '6836b9e53fb09a61fb7fef41-mekxrg73';
    const redirectUri = 'https://www.closeos.fr/api/ghll/callback';
    const state = `${user?.id}__business`;
    window.location.href = `https://marketplace.gohighlevel.com/oauth/chooselocation?response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&client_id=${clientId}&scope=contacts.readonly contacts.write opportunities.readonly opportunities.write locations.readonly&state=${state}`;
  };

  const handleDisconnectGhl = async () => {
    if (!user || !window.confirm('Déconnecter GoHighLevel ?')) return;
    await supabase.from('profiles').update({
      ghl_access_token: null,
      ghl_refresh_token: null,
      ghl_token_expires_at: null,
      ghl_location_id: null,
    }).eq('id', user.id);
    window.location.reload();
  };

  const handleSyncGhl = async () => {
    setSyncResult(null);
    const result = await syncGhl();
    if (result) setSyncResult(result);
  };

  const handleSaveGhlConfig = async (pipelineId: string, stageMapping: Record<string, string>) => {
    if (!user) return;
    setGhlSavingConfig(true);
    try {
      await fetch('/api/business-crm-sync?action=ghl-save-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, ghl_config: { pipelineId, stageMapping } }),
      });
    } catch (err) {
      console.error('Error saving GHL config:', err);
    } finally {
      setGhlSavingConfig(false);
    }
  };

  const handleUpdateGhlMapping = (coStage: string, ghlStageId: string) => {
    const newMappings = { ...ghlMappings, [coStage]: ghlStageId };
    setGhlMappings(newMappings);
    handleSaveGhlConfig(ghlSelectedPipeline, newMappings);
  };

  const handleGhlPipelineChange = (pipelineId: string) => {
    setGhlSelectedPipeline(pipelineId);
    handleSaveGhlConfig(pipelineId, ghlMappings);
  };

  const handleConnectAirtable = () => {
    window.location.href = `/api/webhooks?action=airtable-authorize&user_id=${user?.id}`;
  };

  const handleDisconnectAirtable = async () => {
    if (!user || !window.confirm('Déconnecter Airtable ?')) return;
    await supabase.from('profiles').update({
      airtable_access_token: null,
      airtable_refresh_token: null,
      airtable_token_expires_at: null,
    }).eq('id', user.id);
    window.location.reload();
  };

  const handleSaveAirtableConfig = async () => {
    if (!user) return;
    setAirtableSavingConfig(true);
    try {
      await updateBusinessSettings({
        airtable_config: {
          baseId: airtableBaseId,
          tableId: airtableTableId,
          fieldMapping: airtableFieldMapping,
          stageMapping: airtableStageMapping,
        },
      });
    } catch (err) {
      console.error('Error saving Airtable config:', err);
    } finally {
      setAirtableSavingConfig(false);
    }
  };

  const handleSyncAirtable = async () => {
    setSyncResult(null);
    const result = await syncAirtable();
    if (result) setSyncResult(result);
  };

  const handleGenerateCalendlyKey = async () => {
    if (!user) return;
    setCalendlyLoading(true);
    try {
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      const newKey = 'cal_' + Array.from(array, b => b.toString(16).padStart(2, '0')).join('');

      const { data, error } = await supabase
        .from('business_webhook_keys')
        .insert({ user_id: user.id, api_key: newKey, name: 'Calendly' })
        .select()
        .single();

      if (error) throw error;
      setCalendlyApiKey(newKey);
      setCalendlyKeyId(data.id);
      setCalendlyShowKey(true);
    } catch (err) {
      console.error('Error generating Calendly key:', err);
    } finally {
      setCalendlyLoading(false);
    }
  };

  const handleDeleteCalendlyKey = async () => {
    if (!calendlyKeyId || !window.confirm('Supprimer cette clé API ? Le webhook Calendly ne fonctionnera plus.')) return;
    setCalendlyLoading(true);
    try {
      await supabase.from('business_webhook_keys').delete().eq('id', calendlyKeyId);
      setCalendlyApiKey(null);
      setCalendlyKeyId(null);
      setCalendlyShowKey(false);
    } catch (err) {
      console.error('Error deleting Calendly key:', err);
    } finally {
      setCalendlyLoading(false);
    }
  };

  const handleGenerateIclosedKey = async () => {
    if (!user) return;
    setIclosedLoading(true);
    try {
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      const newKey = 'ic_' + Array.from(array, b => b.toString(16).padStart(2, '0')).join('');

      const { data, error } = await supabase
        .from('business_webhook_keys')
        .insert({ user_id: user.id, api_key: newKey, name: 'iClosed' })
        .select()
        .single();

      if (error) throw error;
      setIclosedApiKey(newKey);
      setIclosedKeyId(data.id);
      setIclosedShowKey(true);
    } catch (err) {
      console.error('Error generating iClosed key:', err);
    } finally {
      setIclosedLoading(false);
    }
  };

  const handleDeleteIclosedKey = async () => {
    if (!iclosedKeyId || !window.confirm('Supprimer cette clé API ? Le webhook iClosed ne fonctionnera plus.')) return;
    setIclosedLoading(true);
    try {
      await supabase.from('business_webhook_keys').delete().eq('id', iclosedKeyId);
      setIclosedApiKey(null);
      setIclosedKeyId(null);
      setIclosedShowKey(false);
    } catch (err) {
      console.error('Error deleting iClosed key:', err);
    } finally {
      setIclosedLoading(false);
    }
  };

  const handleAddIclosedMapping = () => {
    setIclosedMappings(prev => [...prev, { name: '', stage: 'prospect' }]);
  };

  const handleRemoveIclosedMapping = (index: number) => {
    setIclosedMappings(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateIclosedMapping = (index: number, field: 'name' | 'stage', value: string) => {
    setIclosedMappings(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
  };

  const handleSaveIclosedMappings = async () => {
    setIclosedMappingSaving(true);
    try {
      const obj: Record<string, string> = {};
      for (const m of iclosedMappings) {
        const key = (m.name || '').trim();
        if (!key) continue;
        obj[key] = m.stage;
      }
      await updateBusinessSettings({ iclosed_stage_mapping: obj });
      toast.success('Mapping enregistré');
    } catch (err) {
      console.error('Error saving iClosed mapping:', err);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIclosedMappingSaving(false);
    }
  };

  const handleSaveIclosedPushKey = async () => {
    setIclosedPushKeySaving(true);
    try {
      const trimmed = (iclosedPushKey || '').trim();
      if (trimmed && !trimmed.startsWith('iclosed_')) {
        toast.error('La clé doit commencer par "iclosed_"');
        return;
      }
      await updateBusinessSettings({ iclosed_api_key: trimmed || null } as any);
      toast.success(trimmed ? 'Clé enregistrée' : 'Clé supprimée');
    } catch (err) {
      console.error('Error saving iClosed push key:', err);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIclosedPushKeySaving(false);
    }
  };

  const [iclosedSyncing, setIclosedSyncing] = useState(false);
  const [iclosedSyncResult, setIclosedSyncResult] = useState<{ imported: number; updated: number } | null>(null);

  const handleSyncIclosedNow = async () => {
    setIclosedSyncing(true);
    setIclosedSyncResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        toast.error('Session expirée — reconnectez-vous');
        return;
      }
      let totalImported = 0;
      let totalUpdated = 0;
      let nextPage: number | null = 0;
      // Loop until partial=false (in case the run hits the time/page cap)
      for (let safety = 0; safety < 20; safety++) {
        const res: Response = await fetch('/api/webhooks?action=iclosed-sync-business', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ startPage: nextPage }),
        });
        const json: any = await res.json();
        if (!json?.ok) {
          toast.error(json?.message || 'Erreur de synchronisation iClosed');
          return;
        }
        totalImported += Number(json.imported || 0);
        totalUpdated += Number(json.updated || 0);
        if (!json.partial) break;
        nextPage = Number(json.nextPage || 0);
        if (!nextPage) break;
      }
      setIclosedSyncResult({ imported: totalImported, updated: totalUpdated });
      toast.success(`${totalImported} importés, ${totalUpdated} mis à jour`);
    } catch (err: any) {
      console.error('Error syncing iClosed:', err);
      toast.error('Échec de la synchronisation');
    } finally {
      setIclosedSyncing(false);
    }
  };

  const handleTestIclosedPushKey = async () => {
    setIclosedPushKeyTesting(true);
    try {
      const trimmed = (iclosedPushKey || '').trim();
      if (trimmed && !trimmed.startsWith('iclosed_')) {
        toast.error('La clé doit commencer par "iclosed_"');
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        toast.error('Session expirée — reconnectez-vous');
        return;
      }
      const res = await fetch('/api/webhooks?action=iclosed-business-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ api_key: trimmed || undefined }),
      });
      const json = await res.json();
      if (json?.ok) {
        toast.success('Connexion iClosed OK');
      } else {
        const code = json?.code || 'unknown';
        const msg =
          code === 'auth' ? 'Clé iClosed invalide ou expirée' :
          code === 'config' ? 'Aucune clé iClosed configurée' :
          code === 'rate_limit' ? 'Limite iClosed atteinte, réessayez dans quelques secondes' :
          (json?.message || 'Échec de la connexion iClosed');
        toast.error(msg);
      }
    } catch (err: any) {
      console.error('Error testing iClosed push key:', err);
      toast.error('Échec du test de connexion');
    } finally {
      setIclosedPushKeyTesting(false);
    }
  };

  // ─── CloseOS CRM tab handlers ─────────────────────────────────────────────
  const handleCreateCloseosKey = async () => {
    if (!user) return;
    setCloseosCreatingKey(true);
    try {
      const arr = new Uint8Array(32);
      crypto.getRandomValues(arr);
      const newKey = 'cos_' + Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
      const { error } = await supabase
        .from('business_webhook_keys')
        .insert({ user_id: user.id, api_key: newKey, name: closeosNewKeyName.trim() || 'API CloseOS' });
      if (error) throw error;
      setCloseosNewKeyName('API CloseOS');
      await refreshCloseosKeysAndSubs();
      toast.success('Clé API générée');
    } catch (err: any) {
      console.error('createCloseosKey:', err);
      toast.error('Impossible de générer la clé');
    } finally {
      setCloseosCreatingKey(false);
    }
  };

  const handleDeleteCloseosKey = async (id: string) => {
    if (!window.confirm('Supprimer cette clé API ? Les intégrations qui l\'utilisent ne fonctionneront plus.')) return;
    try {
      await supabase.from('business_webhook_keys').delete().eq('id', id);
      await refreshCloseosKeysAndSubs();
    } catch (err) {
      console.error('deleteCloseosKey:', err);
    }
  };

  const handleToggleCloseosNewSubEvent = (eventId: string) => {
    setCloseosNewSubEvents(prev => prev.includes(eventId) ? prev.filter(e => e !== eventId) : [...prev, eventId]);
  };

  const handleCreateCloseosSub = async () => {
    if (!user) return;
    const url = (closeosNewSubUrl || '').trim();
    if (!url) { toast.error('Renseignez une URL.'); return; }
    if (!/^https?:\/\//i.test(url)) { toast.error('L\'URL doit commencer par http:// ou https://'); return; }
    if (closeosNewSubEvents.length === 0) { toast.error('Sélectionnez au moins un évènement.'); return; }
    setCloseosCreatingSub(true);
    try {
      const arr = new Uint8Array(32);
      crypto.getRandomValues(arr);
      const secret = Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
      const { error } = await supabase
        .from('business_webhook_subscriptions')
        .insert({ user_id: user.id, url, events: closeosNewSubEvents, secret, is_active: true });
      if (error) throw error;
      setCloseosNewSubUrl('');
      setCloseosNewSubEvents(['prospect.created']);
      await refreshCloseosKeysAndSubs();
      toast.success('Webhook ajouté');
    } catch (err: any) {
      console.error('createCloseosSub:', err);
      toast.error('Impossible d\'ajouter le webhook');
    } finally {
      setCloseosCreatingSub(false);
    }
  };

  const handleDeleteCloseosSub = async (id: string) => {
    if (!window.confirm('Supprimer ce webhook ?')) return;
    try {
      await supabase.from('business_webhook_subscriptions').delete().eq('id', id);
      await refreshCloseosKeysAndSubs();
    } catch (err) {
      console.error('deleteCloseosSub:', err);
    }
  };

  const handleTestCloseosSub = async (id: string) => {
    setCloseosTesting(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { toast.error('Session expirée'); return; }
      const res = await fetch('/api/business-test-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subscription_id: id }),
      });
      const data = await res.json().catch(() => ({}));
      await refreshCloseosKeysAndSubs();
      if (data.error) toast.error(`Test : ${data.error}`); else toast.success(`Test : HTTP ${data.status}`);
    } catch (err: any) {
      console.error('testCloseosSub:', err);
      toast.error('Erreur lors du test');
    } finally {
      setCloseosTesting(null);
    }
  };

  const CLOSEOS_EVENT_CATALOG: Array<{ id: string; label: string; description: string }> = [
    { id: 'prospect.created',       label: 'Prospect créé',             description: 'Un nouveau prospect a été ajouté.' },
    { id: 'prospect.updated',       label: 'Prospect mis à jour',       description: 'Un champ du prospect a changé (hors stage).' },
    { id: 'prospect.stage_changed', label: 'Stage modifié',             description: 'Le stage du prospect a changé.' },
    { id: 'prospect.deleted',       label: 'Prospect supprimé',         description: 'Le prospect a été supprimé.' },
    { id: 'campaign.lead_captured', label: 'Lead capturé via campagne', description: 'Lead arrivé via formulaire de capture.' },
    { id: 'appointment.booked',     label: 'Rendez-vous réservé',       description: 'RDV réservé pour ce prospect.' },
    { id: 'appointment.cancelled',  label: 'Rendez-vous annulé',        description: 'RDV annulé.' },
    { id: 'appointment.completed',  label: 'Rendez-vous terminé',       description: 'RDV marqué comme terminé.' },
    { id: 'deal.won',               label: 'Deal gagné',                description: 'Vente conclue (souscription Stripe active ou stage = won).' },
    { id: 'deal.lost',              label: 'Deal perdu',                description: 'Souscription annulée ou stage = lost.' },
  ];

  const handleGenerateZapierKey = async () => {
    if (!user) return;
    setZapierLoading(true);
    try {
      // Generate a secure random key
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      const newKey = 'zk_' + Array.from(array, b => b.toString(16).padStart(2, '0')).join('');

      const { data, error } = await supabase
        .from('business_webhook_keys')
        .insert({ user_id: user.id, api_key: newKey, name: 'Zapier' })
        .select()
        .single();

      if (error) throw error;
      setZapierApiKey(newKey);
      setZapierKeyId(data.id);
      setZapierShowKey(true);
    } catch (err) {
      console.error('Error generating Zapier key:', err);
    } finally {
      setZapierLoading(false);
    }
  };

  const handleDeleteZapierKey = async () => {
    if (!zapierKeyId || !window.confirm('Supprimer cette clé API ? Les Zaps connectés ne fonctionneront plus.')) return;
    setZapierLoading(true);
    try {
      await supabase.from('business_webhook_keys').delete().eq('id', zapierKeyId);
      setZapierApiKey(null);
      setZapierKeyId(null);
      setZapierShowKey(false);
    } catch (err) {
      console.error('Error deleting Zapier key:', err);
    } finally {
      setZapierLoading(false);
    }
  };

  const handleGenerateMakeKey = async () => {
    if (!user) return;
    setMakeLoading(true);
    try {
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      const newKey = 'mk_' + Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
      const { data, error } = await supabase
        .from('business_webhook_keys')
        .insert({ user_id: user.id, api_key: newKey, name: 'Make' })
        .select()
        .single();
      if (error) throw error;
      setMakeApiKey(newKey);
      setMakeKeyId(data.id);
      setMakeShowKey(true);
    } catch (err) {
      console.error('Error generating Make key:', err);
    } finally {
      setMakeLoading(false);
    }
  };

  const handleDeleteMakeKey = async () => {
    if (!makeKeyId || !window.confirm('Supprimer cette clé API ? Les scénarios Make connectés ne fonctionneront plus.')) return;
    setMakeLoading(true);
    try {
      await supabase.from('business_webhook_keys').delete().eq('id', makeKeyId);
      setMakeApiKey(null);
      setMakeKeyId(null);
      setMakeShowKey(false);
    } catch (err) {
      console.error('Error deleting Make key:', err);
    } finally {
      setMakeLoading(false);
    }
  };

  const handleGenerateN8nKey = async () => {
    if (!user) return;
    setN8nLoading(true);
    try {
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      const newKey = 'n8_' + Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
      const { data, error } = await supabase
        .from('business_webhook_keys')
        .insert({ user_id: user.id, api_key: newKey, name: 'n8n' })
        .select()
        .single();
      if (error) throw error;
      setN8nApiKey(newKey);
      setN8nKeyId(data.id);
      setN8nShowKey(true);
    } catch (err) {
      console.error('Error generating n8n key:', err);
    } finally {
      setN8nLoading(false);
    }
  };

  const handleDeleteN8nKey = async () => {
    if (!n8nKeyId || !window.confirm('Supprimer cette clé API ? Les workflows n8n connectés ne fonctionneront plus.')) return;
    setN8nLoading(true);
    try {
      await supabase.from('business_webhook_keys').delete().eq('id', n8nKeyId);
      setN8nApiKey(null);
      setN8nKeyId(null);
      setN8nShowKey(false);
    } catch (err) {
      console.error('Error deleting n8n key:', err);
    } finally {
      setN8nLoading(false);
    }
  };

  if (!isOpen) return null;

  const baseUrl = window.location.origin.includes('localhost') ? 'https://closeos.fr' : window.location.origin;
  const iclosedWebhookUrl = iclosedApiKey ? `${baseUrl}/api/webhooks?action=iclosed-business-webhook&api_key=${iclosedApiKey}` : '';
  const systemeioWebhookUrl = `${baseUrl}/api/systemeio?action=webhook&type=business&user_id=${user?.id}`;

  // CloseOS CRM tab: depend on baseUrl + closeosKeys, computed each render
  const closeosFirstActiveKey = (closeosKeys.find(k => k.is_active) || closeosKeys[0]) as any | undefined;
  const closeosCurlExample = `curl -X POST "${baseUrl}/api/zapier-webhook?type=business" \\
  -H "Authorization: Bearer ${closeosFirstActiveKey?.api_key || 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "firstName":"Jean", "lastName":"Dupont",
    "email":"jean@x.fr", "phone":"+33612345678",
    "stage":"qualified", "status":"hot", "value":4900,
    "external_id":"crm-12345", "campaign_id":7,
    "answers":[{"question":"Budget?","answer":"5k+"}],
    "metadata":{"utm_source":"linkedin","plan":"pro"},
    "call_notes":[{"date":"2026-04-26","note":"premier appel ok"}]
  }'`;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateBusinessSettings({ crm_provider: selected });
      onClose();
    } catch (err) {
      console.error('Error saving CRM provider:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleConnectHubspot = () => {
    const clientId = '4ffa6fe0-353d-4275-9998-2bada782b56c';
    const redirectUri = 'https://www.closeos.fr/api/hubspot/callback';
    const scopes = 'crm.objects.contacts.write oauth crm.objects.deals.read crm.objects.deals.write crm.objects.contacts.read';
    const state = user?.id;
    window.location.href = `https://app-eu1.hubspot.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${state}`;
  };

  const handleDisconnectHubspot = async () => {
    if (!user || !window.confirm('Déconnecter HubSpot ?')) return;
    await supabase.from('profiles').update({
      hubspot_access_token: null,
      hubspot_refresh_token: null,
      hubspot_token_expires_at: null,
      hubspot_portal_id: null,
    }).eq('id', user.id);
    window.location.reload();
  };

  const handleSyncHubspot = async () => {
    setSyncResult(null);
    const result = await syncHubspot();
    if (result) setSyncResult(result);
  };

  const handleConnectPipedrive = () => {
    const clientId = 'd8a07042c2506596';
    const redirectUri = 'https://www.closeos.fr/api/pipedrive/callback';
    const state = user?.id;
    window.location.href = `https://oauth.pipedrive.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
  };

  const handleDisconnectPipedrive = async () => {
    if (!user || !window.confirm('Déconnecter Pipedrive ?')) return;
    await supabase.from('profiles').update({
      pipedrive_access_token: null,
      pipedrive_refresh_token: null,
      pipedrive_token_expires_at: null,
      pipedrive_api_domain: null,
    }).eq('id', user.id);
    window.location.reload();
  };

  const handleSyncPipedrive = async () => {
    setSyncResult(null);
    const result = await syncPipedrive();
    if (result) setSyncResult(result);
  };

  const handleUpdatePipedriveMapping = async (coStage: string, pStageId: number) => {
    const newMappings = { ...pipedriveMappings, [coStage]: pStageId };
    setPipedriveMappings(newMappings);

    try {
      await fetch('/api/business-crm-sync?action=pipedrive-save-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id, mappings: newMappings }),
      });
    } catch (err) {
      console.error('Error saving mapping:', err);
    }
  };

  // ─── CSV Export ───
  const handleCsvExport = () => {
    const headers = ['contact', 'email', 'phone', 'company', 'stage', 'value', 'offer', 'notes', 'created_at']
    const rows = prospects.map(p => headers.map(h => {
      const val = (p as any)[h] ?? ''
      const str = String(val).replace(/"/g, '""')
      return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str
    }).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `closeos-prospects-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`${prospects.length} prospects exportés`)
  }

  // ─── CSV Import ───
  const VALID_STAGES = CLOSEOS_STAGES.map(s => s.id)
  const STAGE_ALIASES: Record<string, string> = {
    'prospect': 'prospect', 'new': 'prospect', 'nouveau': 'prospect', 'lead': 'prospect', 'nouveau lead': 'prospect',
    'qualifié': 'qualified', 'qualified': 'qualified', 'qualifie': 'qualified',
    'gagné': 'won', 'won': 'won', 'gagne': 'won', 'closed': 'won', 'closé': 'won', 'client': 'won',
    'follow up': 'followup', 'followup': 'followup', 'follow-up': 'followup', 'relance': 'followup', 'suivi': 'followup',
    'no show': 'noshow', 'noshow': 'noshow', 'no-show': 'noshow', 'absent': 'noshow',
    'perdu': 'lost', 'lost': 'lost', 'refusé': 'lost', 'refuse': 'lost',
  }

  const resolveStage = (raw: string): { stage: string; wasDefault: boolean } => {
    const normalized = raw.trim().toLowerCase()
    if (!normalized) return { stage: 'prospect', wasDefault: true }
    if (VALID_STAGES.includes(normalized)) return { stage: normalized, wasDefault: false }
    if (STAGE_ALIASES[normalized]) return { stage: STAGE_ALIASES[normalized], wasDefault: false }
    return { stage: 'prospect', wasDefault: true }
  }

  const parseCsvLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++ }
        else if (ch === '"') inQuotes = false
        else current += ch
      } else {
        if (ch === '"') inQuotes = true
        else if (ch === ',' || ch === ';') { result.push(current.trim()); current = '' }
        else current += ch
      }
    }
    result.push(current.trim())
    return result
  }

  const handleCsvImport = async (file: File) => {
    setCsvImporting(true)
    setCsvResult(null)
    try {
      const text = await file.text()
      const lines = text.split(/\r?\n/).filter(l => l.trim())
      if (lines.length < 2) { toast.error('Le fichier CSV est vide ou ne contient que les en-têtes.'); return }

      const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9_àâéèêëïôùûç]/g, ''))
      const colMap: Record<string, number> = {}
      const aliases: Record<string, string[]> = {
        contact: ['contact', 'nom', 'name', 'fullname', 'full_name', 'nomdufamille', 'prenom', 'prénom'],
        email: ['email', 'mail', 'emailaddress', 'adresseemail', 'courriel', 'e_mail'],
        phone: ['phone', 'telephone', 'téléphone', 'tel', 'phonenumber', 'mobile', 'numéro'],
        company: ['company', 'entreprise', 'société', 'societe', 'organisation', 'org'],
        stage: ['stage', 'statut', 'status', 'étape', 'etape', 'pipeline', 'state'],
        value: ['value', 'valeur', 'montant', 'amount', 'deal', 'revenue', 'ca'],
        offer: ['offer', 'offre', 'produit', 'product', 'service', 'formule'],
        notes: ['notes', 'note', 'commentaire', 'comment', 'description', 'remarque'],
      }
      for (const [field, aliasList] of Object.entries(aliases)) {
        const idx = headers.findIndex(h => aliasList.some(a => h.includes(a)))
        if (idx !== -1) colMap[field] = idx
      }

      if (colMap.contact === undefined && colMap.email === undefined) {
        toast.error('Colonnes "contact" ou "email" introuvables. Vérifiez les en-têtes du CSV.')
        return
      }

      let imported = 0, skipped = 0, defaulted = 0
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i])
        const contact = cols[colMap.contact] || ''
        const email = cols[colMap.email] || ''
        if (!contact && !email) { skipped++; continue }

        const stageRaw = colMap.stage !== undefined ? (cols[colMap.stage] || '') : ''
        const { stage, wasDefault } = resolveStage(stageRaw)
        if (wasDefault && stageRaw) defaulted++

        try {
          await addProspect({
            contact: contact || email.split('@')[0] || 'Sans nom',
            email: email,
            phone: colMap.phone !== undefined ? (cols[colMap.phone] || '') : '',
            company: colMap.company !== undefined ? (cols[colMap.company] || '') : '',
            stage,
            value: colMap.value !== undefined ? (parseFloat(cols[colMap.value]?.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0) : 0,
            offer: colMap.offer !== undefined ? (cols[colMap.offer] || '') : '',
            notes: colMap.notes !== undefined ? (cols[colMap.notes] || '') : '',
          })
          imported++
        } catch { skipped++ }
      }
      setCsvResult({ imported, skipped, defaulted })
      toast.success(`${imported} prospects importés`)
    } catch (err) {
      console.error('CSV import error:', err)
      toast.error('Erreur lors de l\'import du CSV.')
    } finally {
      setCsvImporting(false)
      if (csvFileRef.current) csvFileRef.current.value = ''
    }
  }

  const CSV_AI_PROMPT = `Transforme mon fichier CSV en un format compatible avec CloseOS CRM. Le CSV final doit avoir exactement ces colonnes en en-tête (première ligne) :

contact,email,phone,company,stage,value,offer,notes

Règles :
- "contact" = nom complet du prospect (obligatoire)
- "email" = adresse email (obligatoire si pas de contact)
- "phone" = numéro de téléphone avec indicatif (ex: +33 6 12 34 56 78)
- "company" = nom de l'entreprise
- "stage" = un de ces statuts EXACTEMENT : prospect, qualified, won, followup, noshow, lost
  → Si le statut actuel ne correspond à aucun, utilise "prospect"
  → Correspondances : nouveau/lead/new → prospect, qualifié → qualified, gagné/closé/client → won, relance/suivi → followup, absent → noshow, perdu/refusé → lost
- "value" = montant numérique (ex: 1500)
- "offer" = nom du produit/offre
- "notes" = commentaires/notes

Le séparateur doit être une virgule. Les champs contenant des virgules doivent être entre guillemets. Encodage UTF-8.`

  const selectedCrm = CRM_OPTIONS.find(c => c.id === selected);
  const isConnected = (selected === 'hubspot' && hubspotConnected) ||
    (selected === 'pipedrive' && pipedriveConnected) ||
    (selected === 'airtable' && airtableConnected) ||
    (selected === 'ghl' && ghlConnected) ||
    (selected === 'zapier' && !!zapierApiKey) ||
    (selected === 'make' && !!makeApiKey) ||
    (selected === 'n8n' && !!n8nApiKey) ||
    (selected === 'calendly' && !!calendlyApiKey) ||
    (selected === 'iclosed' && !!iclosedApiKey) ||
    selected === 'closeos';

  const selectCls = "w-full bg-white dark:bg-neutral-800 border border-[#c4c7c7]/30 dark:border-neutral-700 rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-[#006c49]/20 focus:border-[#006c49] text-[#1b1c1b] dark:text-white";
  const inputCls = "w-full bg-[#f5f3f2] dark:bg-neutral-800 border-none rounded-xl py-3 px-4 text-sm font-mono text-[#444748] dark:text-neutral-300 focus:ring-2 focus:ring-[#006c49]/20";

  return (
    <div className="fixed inset-0 z-50 bg-[#1b1c1b]/20 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-900 w-full max-w-5xl max-h-[85vh] rounded-2xl shadow-[0_40px_80px_rgba(27,28,27,0.12)] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-8 py-8 border-b border-[#c4c7c7]/10 dark:border-neutral-700 flex justify-between items-start flex-shrink-0">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Intégration CRM</h1>
            <p className="text-[#444748] dark:text-neutral-300 mt-2 text-sm">Choisissez et configurez votre CRM pour synchroniser vos données.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#eae8e7] dark:hover:bg-neutral-800 rounded-full transition-colors">
            <X className="h-5 w-5 text-[#444748]" />
          </button>
        </div>

        {/* Modal Content (Split Layout) */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Left Sidebar — CRM Selection */}
          <div className="w-full md:w-72 bg-[#f5f3f2] dark:bg-neutral-900 md:border-r border-b md:border-b-0 border-[#c4c7c7]/10 dark:border-neutral-700 md:overflow-y-auto overflow-x-auto p-4 md:space-y-2 flex md:flex-col flex-row gap-2 md:gap-0 flex-shrink-0">
            <label className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#444748]/50 block">Available Integrations</label>
            {CRM_OPTIONS.map((crm) => {
              const isActive = selected === crm.id;
              const isCrmConnected = (crm.id === 'hubspot' && hubspotConnected) ||
                (crm.id === 'pipedrive' && pipedriveConnected) ||
                (crm.id === 'airtable' && airtableConnected) ||
                (crm.id === 'ghl' && ghlConnected) ||
                (crm.id === 'zapier' && !!zapierApiKey) ||
                (crm.id === 'make' && !!makeApiKey) ||
                (crm.id === 'n8n' && !!n8nApiKey) ||
                (crm.id === 'calendly' && !!calendlyApiKey);
              return (
                <button
                  key={crm.id}
                  onClick={() => { setSelected(crm.id); setSyncResult(null); }}
                  className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl transition-all ${
                    isActive
                      ? 'bg-[#e4e2e1] dark:bg-neutral-800 shadow-inner ring-1 ring-[#1b1c1b]/10 dark:ring-neutral-700'
                      : 'hover:bg-[#eae8e7] dark:hover:bg-neutral-800'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl ${crm.logo ? 'bg-white dark:bg-neutral-800' : crm.iconBg} flex items-center justify-center shrink-0 overflow-hidden`}>
                    {crm.logo ? (
                      <img src={crm.logo} alt={crm.name} className="w-7 h-7 object-contain" />
                    ) : (
                      <span className={`font-bold text-sm ${crm.iconText}`}>{crm.name[0]}</span>
                    )}
                  </div>
                  <span className={`font-bold text-sm ${isActive ? 'text-[#1b1c1b] dark:text-white' : 'text-[#444748] dark:text-neutral-400'}`} style={{ fontFamily: 'Manrope, sans-serif' }}>{crm.name}</span>
                  {isCrmConnected && <div className="ml-auto w-2 h-2 rounded-full bg-[#006c49]" />}
                </button>
              );
            })}
          </div>

          {/* Right Configuration Area */}
          <div className="flex-1 overflow-y-auto p-10 bg-white dark:bg-neutral-900">
            {selectedCrm && (
              <section className="max-w-2xl">
                {/* CRM Header */}
                <div className="flex items-center gap-6 mb-10">
                  <div className={`w-20 h-20 rounded-2xl ${selectedCrm.logo ? 'bg-white dark:bg-neutral-800' : selectedCrm.iconBg} flex items-center justify-center shadow-xl overflow-hidden`} style={{ boxShadow: `0 10px 30px ${selectedCrm.iconBg.includes('#ff7a59') ? 'rgba(255,122,89,0.2)' : selectedCrm.iconBg.includes('#ff4a00') ? 'rgba(255,74,0,0.2)' : selectedCrm.iconBg.includes('#006bff') ? 'rgba(0,107,255,0.2)' : selectedCrm.iconBg.includes('#18bfff') ? 'rgba(24,191,255,0.2)' : 'rgba(27,28,27,0.1)'}` }}>
                    {selectedCrm.logo ? (
                      <img src={selectedCrm.logo} alt={selectedCrm.name} className="w-14 h-14 object-contain" />
                    ) : (
                      <span className={`font-extrabold text-2xl ${selectedCrm.iconText}`}>{selectedCrm.name[0]}</span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-2xl md:text-3xl font-extrabold text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>{selectedCrm.name}</h3>
                    {isConnected && (
                      <p className="text-[#006c49] font-semibold text-sm flex items-center gap-1.5 mt-1">
                        <Check className="h-4 w-4" />
                        Connecté
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-8">
                  {/* ─── CloseOS CRM (native API + outbound webhooks) ─── */}
                  {selected === 'closeos' && (
                    <div className="space-y-6">
                      <div className="p-8 rounded-2xl bg-[#f5f3f2] dark:bg-neutral-800 border border-[#c4c7c7]/5 dark:border-neutral-700">
                        <h4 className="font-bold text-lg mb-2 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>CRM Intégré CloseOS</h4>
                        <p className="text-[#444748] dark:text-neutral-300 text-sm">
                          Activé par défaut — aucune configuration nécessaire. Vous pouvez aussi exposer une API REST entrante et configurer des webhooks sortants pour brancher vos automatisations.
                        </p>
                      </div>

                      {!hasApiAccess && (
                        <div className="relative overflow-hidden p-8 rounded-2xl bg-gradient-to-br from-[#1b1c1b] via-[#2a1538] to-[#1b1c1b] border border-[#d511fd]/30 text-white">
                          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-[#d511fd]/15 blur-3xl pointer-events-none" />
                          <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-[#ff2f2f]/10 blur-3xl pointer-events-none" />
                          <div className="relative">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 mb-4">
                              <Sparkles className="h-3 w-3 text-[#d511fd]" />
                              <span className="text-[10px] uppercase font-bold tracking-[0.15em] text-white/80">Fonctionnalité Pro</span>
                            </div>
                            <h4 className="font-extrabold text-2xl mb-3 tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                              L'API & les webhooks ne sont pas inclus dans la formule Business
                            </h4>
                            <p className="text-white/70 text-sm leading-relaxed mb-6 max-w-2xl">
                              Pour accéder à l'API REST entrante, aux webhooks sortants signés HMAC et à la documentation développeur,
                              passez à la formule <strong className="text-white">Business + Acquisition</strong>, <strong className="text-white">Solo</strong> ou <strong className="text-white">Enterprise</strong>.
                              Le CRM intégré CloseOS reste disponible et fonctionnel sur votre formule actuelle.
                            </p>
                            <div className="flex flex-wrap gap-3">
                              <a
                                href="/tarifs"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-5 py-2.5 bg-white text-[#1b1c1b] rounded-full font-bold text-sm flex items-center gap-2 hover:bg-white/90 transition-colors"
                              >
                                <Sparkles className="h-4 w-4" />
                                Voir les formules
                              </a>
                              <a
                                href="/business/docs/api"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-5 py-2.5 border border-white/20 rounded-full font-bold text-sm flex items-center gap-2 hover:bg-white/5 transition-colors"
                              >
                                <ExternalLink className="h-4 w-4" />
                                Voir la documentation
                              </a>
                            </div>
                          </div>
                        </div>
                      )}

                      {hasApiAccess && (<>

                      {/* ── Section A : Clés API entrantes ───────────────── */}
                      <div className="p-8 rounded-2xl bg-[#f5f3f2] dark:bg-neutral-800 border border-[#c4c7c7]/5 dark:border-neutral-700">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-bold text-lg text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Clés API entrantes</h4>
                        </div>
                        <p className="text-[#444748] dark:text-neutral-300 text-sm mb-6">
                          Ces clés permettent à un service externe de pousser des prospects dans CloseOS via l'API REST.
                        </p>

                        <div className="flex gap-2 mb-6">
                          <input
                            type="text"
                            value={closeosNewKeyName}
                            onChange={e => setCloseosNewKeyName(e.target.value)}
                            placeholder="Nom de la clé (ex. Mon backend)"
                            className={inputCls + ' flex-1'}
                          />
                          <button
                            onClick={handleCreateCloseosKey}
                            disabled={closeosCreatingKey}
                            className="px-5 py-2.5 bg-[#1b1c1b] text-white rounded-full font-bold text-sm flex items-center gap-2 hover:bg-[#1b1c1b]/80 transition-colors disabled:opacity-50"
                          >
                            {closeosCreatingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
                            Générer
                          </button>
                        </div>

                        {closeosKeys.length === 0 ? (
                          <p className="text-xs text-[#444748]/60 italic">Aucune clé. Générez-en une pour commencer.</p>
                        ) : (
                          <div className="space-y-3">
                            {closeosKeys.map(k => {
                              const masked = closeosShowKey[k.id]
                                ? k.api_key
                                : (k.api_key ? `${k.api_key.slice(0, 6)}••••••••${k.api_key.slice(-4)}` : '••••');
                              return (
                                <div key={k.id} className="bg-white dark:bg-neutral-900 rounded-xl border border-[#c4c7c7]/20 p-4">
                                  <div className="flex items-center justify-between gap-4 flex-wrap">
                                    <div>
                                      <p className="text-sm font-bold text-[#1b1c1b] dark:text-white">{k.name || 'Clé API'}</p>
                                      <p className="text-[11px] text-[#444748]/60">Créée {new Date(k.created_at).toLocaleDateString('fr-FR')}</p>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                      <code className="text-xs font-mono px-3 py-2 rounded-lg bg-[#f5f3f2] dark:bg-neutral-800">{masked}</code>
                                      <button
                                        onClick={() => setCloseosShowKey(prev => ({ ...prev, [k.id]: !prev[k.id] }))}
                                        className="p-2 rounded-lg hover:bg-[#eae8e7] transition-colors"
                                        title={closeosShowKey[k.id] ? 'Masquer' : 'Afficher'}
                                      >
                                        {closeosShowKey[k.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                      </button>
                                      <button
                                        onClick={() => { navigator.clipboard.writeText(k.api_key); setCloseosCopiedKey(k.id); setTimeout(() => setCloseosCopiedKey(null), 2000); }}
                                        className="p-2 rounded-lg hover:bg-[#eae8e7] transition-colors"
                                        title="Copier"
                                      >
                                        {closeosCopiedKey === k.id ? <Check className="h-4 w-4 text-[#006c49]" /> : <Copy className="h-4 w-4" />}
                                      </button>
                                      <button
                                        onClick={() => handleDeleteCloseosKey(k.id)}
                                        className="p-2 rounded-lg hover:bg-[#eae8e7] text-[#444748] hover:text-[#ba1a1a] transition-colors"
                                        title="Supprimer"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* ── Section B : Endpoint entrant + cURL ──────────── */}
                      <div className="p-8 rounded-2xl bg-[#f5f3f2] dark:bg-neutral-800 border border-[#c4c7c7]/5 dark:border-neutral-700">
                        <h4 className="font-bold text-lg mb-2 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Endpoint entrant</h4>
                        <p className="text-[#444748] dark:text-neutral-300 text-sm mb-4">
                          POSTez sur cette URL avec votre clé API en <code className="text-xs font-mono">Authorization: Bearer &lt;clé&gt;</code>.
                          Tous les champs ci-dessous sont supportés. Tout champ supplémentaire est conservé dans <code className="text-xs">metadata</code>.
                          Si <code className="text-xs">external_id</code> est fourni, l'appel devient <strong>idempotent</strong> (création OU mise à jour).
                        </p>
                        <div className="rounded-xl overflow-hidden border border-[#c4c7c7]/20">
                          <div className="flex items-center justify-between px-4 py-2 bg-[#1b1c1b] text-[#999]">
                            <span className="text-[11px] font-mono uppercase">cURL</span>
                            <button
                              onClick={() => { navigator.clipboard.writeText(closeosCurlExample); setCloseosCopiedCurl(true); setTimeout(() => setCloseosCopiedCurl(false), 2000); }}
                              className="text-[11px] font-bold text-white hover:text-[#ffb95f] flex items-center gap-1"
                            >
                              {closeosCopiedCurl ? <><Check className="h-3 w-3" /> Copié</> : <><Copy className="h-3 w-3" /> Copier</>}
                            </button>
                          </div>
                          <pre className="bg-[#1b1c1b] text-[#e5e5e5] text-[12px] font-mono p-4 overflow-x-auto leading-relaxed whitespace-pre">{closeosCurlExample}</pre>
                        </div>
                      </div>

                      {/* ── Section C : Webhooks sortants ────────────────── */}
                      <div className="p-8 rounded-2xl bg-[#f5f3f2] dark:bg-neutral-800 border border-[#c4c7c7]/5 dark:border-neutral-700">
                        <h4 className="font-bold text-lg mb-2 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Webhooks sortants</h4>
                        <p className="text-[#444748] dark:text-neutral-300 text-sm mb-6">
                          CloseOS POSTera vers vos URLs à chaque évènement. Le payload est signé HMAC-SHA256 (header <code className="text-xs">X-CloseOS-Signature</code>).
                        </p>

                        {/* Add form */}
                        <div className="space-y-3 mb-6 bg-white dark:bg-neutral-900 rounded-xl border border-[#c4c7c7]/20 p-4">
                          <input
                            type="url"
                            value={closeosNewSubUrl}
                            onChange={e => setCloseosNewSubUrl(e.target.value)}
                            placeholder="https://votre-service.com/webhooks/closeos"
                            className={inputCls}
                          />
                          <div className="flex flex-wrap gap-2">
                            {CLOSEOS_EVENT_CATALOG.map(ev => {
                              const active = closeosNewSubEvents.includes(ev.id);
                              return (
                                <button
                                  key={ev.id}
                                  onClick={() => handleToggleCloseosNewSubEvent(ev.id)}
                                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                                    active
                                      ? 'bg-[#1b1c1b] text-white border-[#1b1c1b]'
                                      : 'bg-transparent text-[#1b1c1b] dark:text-white border-[#c4c7c7]/40 hover:bg-[#f5f3f2]'
                                  }`}
                                  title={ev.description}
                                >
                                  {active && <Check className="inline h-3 w-3 mr-1" />}
                                  {ev.label}
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex justify-end">
                            <button
                              onClick={handleCreateCloseosSub}
                              disabled={closeosCreatingSub}
                              className="px-5 py-2.5 bg-[#1b1c1b] text-white rounded-full font-bold text-sm flex items-center gap-2 hover:bg-[#1b1c1b]/80 transition-colors disabled:opacity-50"
                            >
                              {closeosCreatingSub ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
                              Ajouter le webhook
                            </button>
                          </div>
                        </div>

                        {/* List */}
                        {closeosSubs.length === 0 ? (
                          <p className="text-xs text-[#444748]/60 italic">Aucun webhook configuré.</p>
                        ) : (
                          <div className="space-y-3">
                            {closeosSubs.map(s => {
                              const showSecret = !!closeosShowSecret[s.id];
                              const maskedSecret = showSecret
                                ? s.secret
                                : (s.secret ? `${s.secret.slice(0, 6)}••••••••${s.secret.slice(-4)}` : '••••');
                              const status = s.last_status as number | null;
                              const statusColor =
                                status === null || status === undefined ? 'bg-[#c4c7c7]/30 text-[#444748]' :
                                status >= 200 && status < 300 ? 'bg-[#006c49]/15 text-[#006c49]' :
                                status === 0 ? 'bg-[#ffb95f]/30 text-[#b87500]' :
                                'bg-[#ba1a1a]/15 text-[#ba1a1a]';
                              return (
                                <div key={s.id} className="bg-white dark:bg-neutral-900 rounded-xl border border-[#c4c7c7]/20 p-4 space-y-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-mono text-[#1b1c1b] dark:text-white break-all">{s.url}</p>
                                      <div className="flex flex-wrap gap-1.5 mt-2">
                                        {(s.events || []).map((ev: string) => (
                                          <span key={ev} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f5f3f2] text-[#444748] border border-[#c4c7c7]/20">{ev}</span>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {status !== null && status !== undefined && (
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${statusColor}`}>
                                          {status === 0 ? 'NETWORK' : `HTTP ${status}`}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] font-bold text-[#444748]/60 uppercase">Secret</span>
                                    <code className="text-xs font-mono px-3 py-1.5 rounded-lg bg-[#f5f3f2] dark:bg-neutral-800">{maskedSecret}</code>
                                    <button
                                      onClick={() => setCloseosShowSecret(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
                                      className="p-2 rounded-lg hover:bg-[#eae8e7] transition-colors"
                                      title={showSecret ? 'Masquer' : 'Afficher'}
                                    >
                                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                    <button
                                      onClick={() => { navigator.clipboard.writeText(s.secret); setCloseosCopiedSecret(s.id); setTimeout(() => setCloseosCopiedSecret(null), 2000); }}
                                      className="p-2 rounded-lg hover:bg-[#eae8e7] transition-colors"
                                      title="Copier"
                                    >
                                      {closeosCopiedSecret === s.id ? <Check className="h-4 w-4 text-[#006c49]" /> : <Copy className="h-4 w-4" />}
                                    </button>
                                  </div>

                                  {s.last_error && (
                                    <p className="text-[11px] text-[#ba1a1a]">Dernière erreur : {s.last_error}</p>
                                  )}
                                  {s.last_triggered_at && (
                                    <p className="text-[10px] text-[#444748]/60">Dernier envoi : {new Date(s.last_triggered_at).toLocaleString('fr-FR')}</p>
                                  )}

                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={() => handleTestCloseosSub(s.id)}
                                      disabled={closeosTesting === s.id}
                                      className="px-4 py-2 border border-[#c4c7c7]/40 rounded-full font-bold text-xs text-[#1b1c1b] dark:text-white hover:bg-[#f5f3f2] transition-colors disabled:opacity-50 flex items-center gap-1.5"
                                    >
                                      {closeosTesting === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                                      Tester
                                    </button>
                                    <button
                                      onClick={() => handleDeleteCloseosSub(s.id)}
                                      className="px-4 py-2 border border-[#c4c7c7]/40 rounded-full font-bold text-xs text-[#444748] hover:text-[#ba1a1a] hover:border-[#ba1a1a]/30 transition-colors flex items-center gap-1.5"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                      Supprimer
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* ── Section D : Documentation inline ─────────────── */}
                      <div className="p-8 rounded-2xl bg-[#f5f3f2] dark:bg-neutral-800 border border-[#c4c7c7]/5 dark:border-neutral-700">
                        <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
                          <h4 className="font-bold text-lg text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Documentation</h4>
                          <a
                            href="/business/docs/api"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-[#1b1c1b] text-white rounded-full font-bold text-xs flex items-center gap-1.5 hover:bg-[#1b1c1b]/80 transition-colors"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Voir la documentation complète
                          </a>
                        </div>

                        <div className="mb-6">
                          <h5 className="font-bold text-sm mb-2 text-[#1b1c1b] dark:text-white">Évènements disponibles</h5>
                          <ul className="text-sm space-y-1.5">
                            {CLOSEOS_EVENT_CATALOG.map(ev => (
                              <li key={ev.id} className="flex gap-2">
                                <code className="text-[11px] font-mono px-2 py-0.5 rounded bg-white dark:bg-neutral-900 text-[#1b1c1b] dark:text-white border border-[#c4c7c7]/20 shrink-0">{ev.id}</code>
                                <span className="text-[#444748] dark:text-neutral-300">{ev.description}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="mb-6">
                          <h5 className="font-bold text-sm mb-2 text-[#1b1c1b] dark:text-white">Format du payload</h5>
                          <pre className="bg-[#1b1c1b] text-[#e5e5e5] text-[12px] font-mono p-4 rounded-xl overflow-x-auto leading-relaxed">{`{
  "event": "prospect.stage_changed",
  "product": "business",
  "user_id": "uuid",
  "timestamp": "2026-04-26T12:00:00.000Z",
  "data": {
    /* Ligne complète business_prospects, plus pour stage_changed: */
    "previous_stage": "qualified",
    "new_stage": "won"
  }
}`}</pre>
                        </div>

                        <div>
                          <h5 className="font-bold text-sm mb-2 text-[#1b1c1b] dark:text-white">Vérifier la signature HMAC</h5>
                          <p className="text-sm text-[#444748] dark:text-neutral-300 mb-2">
                            Le header <code className="text-[11px] font-mono">X-CloseOS-Signature</code> contient un HMAC-SHA256 hex de l'enveloppe complète.
                          </p>
                          <pre className="bg-[#1b1c1b] text-[#e5e5e5] text-[12px] font-mono p-4 rounded-xl overflow-x-auto leading-relaxed">{`import crypto from 'crypto'

const sig = req.headers['x-closeos-signature']
const expected = crypto.createHmac('sha256', SECRET)
  .update(req.rawBody)         // exact JSON string envoyé
  .digest('hex')

if (sig !== expected) throw new Error('Invalid signature')`}</pre>
                          <p className="text-[11px] text-[#444748]/70 mt-2">
                            ⚠️ Ne JSON.stringifyez pas <code>req.body</code> côté receveur — utilisez le body brut tel qu'il est arrivé sur la socket. Sinon les espaces/ordres de clés peuvent diverger.
                          </p>
                        </div>
                      </div>

                      </>)}
                    </div>
                  )}

                  {/* ─── iClosed Config ─── */}
                  {selected === 'iclosed' && (
                    <div className="space-y-6">
                      {!iclosedApiKey ? (
                        <div className="p-8 rounded-2xl bg-[#f5f3f2] dark:bg-neutral-800 border border-[#c4c7c7]/5 dark:border-neutral-700">
                          <h4 className="font-bold text-lg mb-2 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Générer une clé API</h4>
                          <p className="text-[#444748] dark:text-neutral-300 text-sm mb-6">Quand un contact est créé ou mis à jour dans iClosed, le prospect sera créé/mis à jour automatiquement dans CloseOS.</p>
                          <button onClick={handleGenerateIclosedKey} disabled={iclosedLoading} className="px-6 py-3 bg-[#1b1c1b] text-white rounded-full font-bold text-sm flex items-center gap-2 hover:bg-[#1b1c1b]/80 transition-colors disabled:opacity-50">
                            {iclosedLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
                            Générer une clé API
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="p-8 rounded-2xl bg-[#f5f3f2] dark:bg-neutral-800 border border-[#c4c7c7]/5 dark:border-neutral-700">
                            <h4 className="font-bold text-lg mb-4 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Webhook & API Access</h4>
                            <div className="space-y-5">
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-[#444748]/60 uppercase">Webhook URL</label>
                                <div className="flex gap-2">
                                  <input type="text" value={iclosedWebhookUrl} readOnly className={inputCls} />
                                  <button onClick={() => { navigator.clipboard.writeText(iclosedWebhookUrl); setIclosedCopiedUrl(true); setTimeout(() => setIclosedCopiedUrl(false), 2000); }} className="p-3 rounded-xl hover:bg-[#eae8e7] transition-colors shrink-0">
                                    {iclosedCopiedUrl ? <Check className="h-4 w-4 text-[#006c49]" /> : <Copy className="h-4 w-4 text-[#444748]" />}
                                  </button>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-[#444748]/60 uppercase">API Key</label>
                                <div className="flex gap-2">
                                  <div className="relative flex-1">
                                    <input type={iclosedShowKey ? 'text' : 'password'} value={iclosedApiKey} readOnly className={inputCls + ' pr-9'} />
                                    <button onClick={() => setIclosedShowKey(!iclosedShowKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444748]/50 hover:text-[#1b1c1b]">
                                      {iclosedShowKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                  </div>
                                  <button onClick={() => { navigator.clipboard.writeText(iclosedApiKey!); setIclosedCopiedKey(true); setTimeout(() => setIclosedCopiedKey(false), 2000); }} className="p-3 rounded-xl hover:bg-[#eae8e7] transition-colors shrink-0">
                                    {iclosedCopiedKey ? <Check className="h-4 w-4 text-[#006c49]" /> : <Copy className="h-4 w-4 text-[#444748]" />}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                          {/* Instructions */}
                          <div className="border-t border-[#c4c7c7]/10 dark:border-neutral-700 pt-6">
                            <h5 className="font-bold text-sm mb-4 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Instructions d'intégration</h5>
                            <ul className="space-y-4">
                              {[
                                'Allez dans iClosed → Paramètres → Développeur → Webhooks.',
                                'Cliquez "Add Webhook" et collez l\'URL ci-dessus.',
                                'Sélectionnez les événements de contact (création / mise à jour de stage).',
                              ].map((text, i) => (
                                <li key={i} className="flex items-start gap-3">
                                  <span className="w-5 h-5 rounded-full bg-[#efedec] text-[10px] font-bold flex items-center justify-center mt-0.5 shrink-0">{i + 1}</span>
                                  <p className="text-sm text-[#444748]">{text}</p>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="p-4 rounded-2xl bg-[#ffb95f]/10 border border-[#ffb95f]/20">
                            <p className="text-[11px] text-[#b87500] font-medium">
                              Important : si le menu "Développeur" n'apparaît pas, c'est que vous n'avez pas les droits. Seul le <strong>Propriétaire</strong> de l'organisation iClosed peut configurer les Webhooks.
                            </p>
                          </div>

                          {/* ─── Custom stage mapping ─── */}
                          <div className="p-8 rounded-2xl bg-[#f5f3f2] dark:bg-neutral-800 border border-[#c4c7c7]/5 dark:border-neutral-700">
                            <h4 className="font-bold text-lg mb-2 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Mapping des stages personnalisés</h4>
                            <p className="text-[#444748] dark:text-neutral-300 text-sm mb-2">Les stages standards iClosed (Customer, No Show, Qualified, etc.) sont reconnus automatiquement.</p>
                            <p className="text-[#444748] dark:text-neutral-300 text-sm mb-6">Si vous avez créé des stages <strong>personnalisés</strong> dans iClosed (ex. "Demo Booked", "Hot Lead"), mappez-les ici vers un stage CloseOS — sinon ils seront classés dans <em>Prospect</em> par défaut.</p>

                            <div className="space-y-3">
                              {iclosedMappings.length === 0 && (
                                <p className="text-xs text-[#444748]/60 italic">Aucun mapping personnalisé.</p>
                              )}
                              {iclosedMappings.map((m, i) => (
                                <div key={i} className="flex gap-2 items-center">
                                  <input
                                    type="text"
                                    value={m.name}
                                    onChange={(e) => handleUpdateIclosedMapping(i, 'name', e.target.value)}
                                    placeholder="Nom du stage iClosed (ex. Demo Booked)"
                                    className={inputCls + ' flex-1'}
                                  />
                                  <span className="text-[#444748]/50 text-sm">→</span>
                                  <select
                                    value={m.stage}
                                    onChange={(e) => handleUpdateIclosedMapping(i, 'stage', e.target.value)}
                                    className={selectCls + ' w-44'}
                                  >
                                    <option value="prospect">Prospect</option>
                                    <option value="qualified">Qualifié</option>
                                    <option value="won">Gagné</option>
                                    <option value="followup">Follow Up</option>
                                    <option value="noshow">No Show</option>
                                    <option value="lost">Perdu</option>
                                  </select>
                                  <button
                                    onClick={() => handleRemoveIclosedMapping(i)}
                                    className="p-3 rounded-xl hover:bg-[#eae8e7] transition-colors shrink-0 text-[#444748] hover:text-[#ba1a1a]"
                                    title="Supprimer ce mapping"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}
                            </div>

                            <div className="flex gap-2 mt-6">
                              <button
                                onClick={handleAddIclosedMapping}
                                className="px-5 py-2.5 border border-[#c4c7c7]/30 rounded-full font-bold text-sm text-[#1b1c1b] dark:text-white hover:bg-white dark:hover:bg-neutral-700 transition-colors"
                              >
                                + Ajouter un mapping
                              </button>
                              <button
                                onClick={handleSaveIclosedMappings}
                                disabled={iclosedMappingSaving}
                                className="px-5 py-2.5 bg-[#1b1c1b] text-white rounded-full font-bold text-sm flex items-center gap-2 hover:bg-[#1b1c1b]/80 transition-colors disabled:opacity-50"
                              >
                                {iclosedMappingSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Enregistrer
                              </button>
                            </div>
                          </div>

                          <div className="flex justify-end">
                            <button onClick={handleDeleteIclosedKey} disabled={iclosedLoading} className="text-xs text-[#444748] hover:text-[#ba1a1a] flex items-center gap-1 font-semibold transition-colors">
                              <Trash2 className="h-3 w-3" /> Supprimer la clé
                            </button>
                          </div>
                        </>
                      )}

                      {/* ─── Push key (CloseOS → iClosed) ─── */}
                      <div className="p-8 rounded-2xl bg-[#f5f3f2] dark:bg-neutral-800 border border-[#c4c7c7]/5 dark:border-neutral-700">
                        <h4 className="font-bold text-lg mb-2 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
                          Push CloseOS → iClosed
                        </h4>
                        <p className="text-[#444748] dark:text-neutral-300 text-sm mb-6">
                          Collez votre clé iClosed personnelle (commençant par <code>iclosed_</code>) pour que les changements de stage CloseOS remontent automatiquement vers iClosed (contact, deal, outcome).
                        </p>

                        <div className="space-y-2">
                          <label className="text-xs font-bold text-[#444748]/60 uppercase">Clé API iClosed</label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <input
                                type={iclosedPushShowKey ? 'text' : 'password'}
                                value={iclosedPushKey}
                                onChange={(e) => setIclosedPushKey(e.target.value)}
                                placeholder="iclosed_..."
                                className={inputCls + ' pr-9'}
                              />
                              <button onClick={() => setIclosedPushShowKey(!iclosedPushShowKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444748]/50 hover:text-[#1b1c1b]">
                                {iclosedPushShowKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mt-6">
                          <button
                            onClick={handleTestIclosedPushKey}
                            disabled={iclosedPushKeyTesting}
                            className="px-5 py-2.5 border border-[#c4c7c7]/30 rounded-full font-bold text-sm text-[#1b1c1b] dark:text-white hover:bg-white dark:hover:bg-neutral-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                          >
                            {iclosedPushKeyTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                            Tester la connexion
                          </button>
                          <button
                            onClick={handleSaveIclosedPushKey}
                            disabled={iclosedPushKeySaving}
                            className="px-5 py-2.5 bg-[#1b1c1b] text-white rounded-full font-bold text-sm flex items-center gap-2 hover:bg-[#1b1c1b]/80 transition-colors disabled:opacity-50"
                          >
                            {iclosedPushKeySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Enregistrer
                          </button>
                        </div>

                        <p className="text-[11px] text-[#444748]/70 mt-4">
                          Trouvez cette clé dans iClosed → <strong>Settings</strong> → <strong>Developer</strong> → <strong>API Keys</strong> → <em>Create API Key</em>. Nécessite un plan Business ou Enterprise iClosed.
                        </p>

                        {/* Sync now */}
                        <div className="mt-6 pt-6 border-t border-[#c4c7c7]/10 dark:border-neutral-700">
                          <h5 className="text-sm font-bold text-[#1b1c1b] dark:text-white mb-2">Synchronisation initiale</h5>
                          <p className="text-[#444748] dark:text-neutral-300 text-xs mb-4">
                            Importez les contacts et RDV iClosed déjà existants dans CloseOS. Les exécutions suivantes ne réimportent que les nouveautés (idempotent par <code>external_id</code>).
                          </p>
                          <button
                            onClick={handleSyncIclosedNow}
                            disabled={iclosedSyncing || !iclosedPushKey || !iclosedPushKey.startsWith('iclosed_')}
                            className="px-5 py-2.5 bg-[#1b1c1b] text-white rounded-full font-bold text-sm flex items-center gap-2 hover:bg-[#1b1c1b]/80 transition-colors disabled:opacity-50"
                          >
                            {iclosedSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            Synchroniser maintenant
                          </button>
                          {iclosedSyncResult && (
                            <p className="text-[11px] text-[#006c49] font-semibold mt-3">
                              ✓ {iclosedSyncResult.imported} importés, {iclosedSyncResult.updated} mis à jour
                            </p>
                          )}
                        </div>
                      </div>

                      <BusinessCRMAutoAssignBlock provider="iclosed" providerLabel="iClosed" />
                    </div>
                  )}

                  {/* ─── HubSpot Config ─── */}
                  {selected === 'hubspot' && (
                    <div className="space-y-6">
                      {!hubspotConnected ? (
                        <div className="p-8 rounded-2xl bg-[#f5f3f2] dark:bg-neutral-800 border border-[#c4c7c7]/5 dark:border-neutral-700">
                          <h4 className="font-bold text-lg mb-2 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Connexion</h4>
                          <p className="text-[#444748] dark:text-neutral-300 text-sm mb-6">Connectez votre compte HubSpot pour synchroniser automatiquement vos contacts.</p>
                          <button onClick={handleConnectHubspot} className="px-6 py-3 bg-[#1b1c1b] text-white rounded-full font-bold text-sm flex items-center gap-2 hover:bg-[#1b1c1b]/80 transition-colors">
                            <LinkIcon className="h-4 w-4" /> Connecter HubSpot
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="p-8 rounded-2xl bg-[#f5f3f2] dark:bg-neutral-800 border border-[#c4c7c7]/5 dark:border-neutral-700">
                            <h4 className="font-bold text-lg mb-2 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Statut de la Synchronisation</h4>
                            <p className="text-[#444748] dark:text-neutral-300 text-sm mb-6">La synchronisation auto se fait toutes les 2 minutes.</p>
                            <div className="flex gap-4 flex-wrap">
                              <button onClick={handleSyncHubspot} disabled={isSyncingHubspot} className="px-6 py-3 bg-[#1b1c1b] text-white rounded-full font-bold text-sm flex items-center gap-2 hover:bg-[#1b1c1b]/80 transition-colors disabled:opacity-50">
                                {isSyncingHubspot ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                Synchroniser maintenant
                              </button>
                              <button onClick={handleDisconnectHubspot} className="px-6 py-3 border border-[#c4c7c7]/30 rounded-full font-bold text-sm text-[#444748] hover:bg-[#f5f3f2] transition-colors">
                                Déconnecter
                              </button>
                            </div>
                          </div>
                          {syncResult && (
                            <div className="p-4 rounded-2xl bg-[#006c49]/5 border border-[#006c49]/10 text-sm text-[#006c49] font-medium">
                              {syncResult.imported} contacts importés, {syncResult.updated} mis à jour
                            </div>
                          )}
                        </>
                      )}
                      <BusinessCRMAutoAssignBlock provider="hubspot" providerLabel="HubSpot" />
                    </div>
                  )}

                  {/* ─── Pipedrive Config ─── */}
                  {selected === 'pipedrive' && (
                    <div className="space-y-6">
                      {!pipedriveConnected ? (
                        <div className="p-8 rounded-2xl bg-[#f5f3f2] dark:bg-neutral-800 border border-[#c4c7c7]/5 dark:border-neutral-700">
                          <h4 className="font-bold text-lg mb-2 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Connexion</h4>
                          <p className="text-[#444748] dark:text-neutral-300 text-sm mb-6">Connectez votre compte Pipedrive pour synchroniser vos deals.</p>
                          <button onClick={handleConnectPipedrive} className="px-6 py-3 bg-[#1b1c1b] text-white rounded-full font-bold text-sm flex items-center gap-2 hover:bg-[#1b1c1b]/80 transition-colors">
                            <LinkIcon className="h-4 w-4" /> Connecter Pipedrive
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="p-8 rounded-2xl bg-[#f5f3f2] dark:bg-neutral-800 border border-[#c4c7c7]/5 dark:border-neutral-700">
                            <h4 className="font-bold text-lg mb-2 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Statut de la Synchronisation</h4>
                            <p className="text-[#444748] dark:text-neutral-300 text-sm mb-6">Les changements de stage sont poussés automatiquement.</p>
                            <div className="flex gap-4 flex-wrap">
                              <button onClick={handleSyncPipedrive} disabled={isSyncingPipedrive} className="px-6 py-3 bg-[#1b1c1b] text-white rounded-full font-bold text-sm flex items-center gap-2 hover:bg-[#1b1c1b]/80 transition-colors disabled:opacity-50">
                                {isSyncingPipedrive ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                Synchroniser maintenant
                              </button>
                              <button onClick={handleDisconnectPipedrive} className="px-6 py-3 border border-[#c4c7c7]/30 rounded-full font-bold text-sm text-[#444748] hover:bg-[#f5f3f2] transition-colors">
                                Déconnecter
                              </button>
                            </div>
                          </div>
                          {syncResult && (
                            <div className="p-4 rounded-2xl bg-[#006c49]/5 border border-[#006c49]/10 text-sm text-[#006c49] font-medium">
                              {syncResult.imported} deals importés, {syncResult.updated} mis à jour
                            </div>
                          )}
                          {/* Stage mapping */}
                          <div className="p-8 rounded-2xl bg-[#f5f3f2]/50 dark:bg-neutral-800/50 border border-[#c4c7c7]/10 dark:border-neutral-700">
                            <h4 className="font-extrabold text-xl mb-6 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Stage Mapping (Pipedrive)</h4>
                            {loadingPipelines ? (
                              <div className="flex items-center gap-2 text-sm text-[#444748]"><Loader2 className="h-4 w-4 animate-spin" /> Chargement...</div>
                            ) : (
                              <div className="grid grid-cols-2 gap-6">
                                {CLOSEOS_STAGES.map(stage => (
                                  <div key={stage.id} className="space-y-2">
                                    <label className="text-xs font-bold text-[#444748]/60 uppercase tracking-tighter">{stage.name}</label>
                                    <select
                                      value={pipedriveMappings[stage.id] || ''}
                                      onChange={(e) => handleUpdatePipedriveMapping(stage.id, Number(e.target.value))}
                                      className={selectCls}
                                    >
                                      <option value="">Sélectionner une étape</option>
                                      {pipedrivePipelines.map(pipe => (
                                        <optgroup key={pipe.id} label={pipe.name}>
                                          {pipedriveStages.filter((s: any) => s.pipeline_id === pipe.id).map((s: any) => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                          ))}
                                        </optgroup>
                                      ))}
                                    </select>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                      <BusinessCRMAutoAssignBlock provider="pipedrive" providerLabel="Pipedrive" />
                    </div>
                  )}

                  {/* ─── Systeme.io Config ─── */}
                  {selected === 'systemeio' && (
                    <div className="space-y-6">
                      <div className="p-8 rounded-2xl bg-[#f5f3f2] dark:bg-neutral-800 border border-[#c4c7c7]/5 dark:border-neutral-700">
                        <h4 className="font-bold text-lg mb-4 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Webhook & API</h4>
                        <div className="space-y-5">
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-[#444748]/60 uppercase tracking-tighter">Clé API Systeme.io</label>
                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <input
                                  type={systemeioShowKey ? 'text' : 'password'}
                                  value={systemeioApiKey}
                                  onChange={(e) => setSystemeioApiKey(e.target.value)}
                                  placeholder="Collez votre clé API ici"
                                  className={inputCls + ' pr-9'}
                                />
                                <button onClick={() => setSystemeioShowKey(!systemeioShowKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444748]/50 hover:text-[#1b1c1b]">
                                  {systemeioShowKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                              <button onClick={handleSaveSystemeioKey} disabled={systemeioSaving} className="px-4 bg-[#1b1c1b] text-white rounded-xl text-sm font-bold hover:bg-[#1b1c1b]/80 transition-colors disabled:opacity-50">
                                {systemeioSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sauvegarder'}
                              </button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-[#444748]/60 uppercase tracking-tighter">Webhook URL</label>
                            <div className="flex gap-2">
                              <input type="text" value={systemeioWebhookUrl} readOnly className={inputCls} />
                              <button onClick={() => { navigator.clipboard.writeText(systemeioWebhookUrl); setSystemeioCopiedUrl(true); setTimeout(() => setSystemeioCopiedUrl(false), 2000); }} className="p-3 rounded-xl bg-[#1b1c1b] text-white hover:bg-[#1b1c1b]/80 transition-colors shrink-0">
                                {systemeioCopiedUrl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* Instructions */}
                      <div className="border-t border-[#c4c7c7]/10 dark:border-neutral-700 pt-6">
                        <h5 className="font-bold text-sm mb-4 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Instructions d'intégration</h5>
                        <ul className="space-y-4">
                          {[
                            'Allez dans Systeme.io → Paramètres → Clés API publiques et copiez votre clé.',
                            'Collez la clé API ci-dessus et cliquez sur Sauvegarder.',
                            'Allez dans Systeme.io → Paramètres → Webhooks et ajoutez l\'URL ci-dessus.',
                          ].map((text, i) => (
                            <li key={i} className="flex items-start gap-3">
                              <span className="w-5 h-5 rounded-full bg-[#efedec] text-[10px] font-bold flex items-center justify-center mt-0.5 shrink-0">{i + 1}</span>
                              <p className="text-sm text-[#444748]">{text}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <BusinessCRMAutoAssignBlock provider="systemeio" providerLabel="Systeme.io" />
                    </div>
                  )}

                  {/* ─── Zapier Config ─── */}
                  {selected === 'zapier' && (
                    <div className="space-y-6">
                      {!zapierApiKey ? (
                        <div className="p-8 rounded-2xl bg-[#f5f3f2] dark:bg-neutral-800 border border-[#c4c7c7]/5 dark:border-neutral-700">
                          <h4 className="font-bold text-lg mb-2 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Générer une clé API</h4>
                          <p className="text-[#444748] dark:text-neutral-300 text-sm mb-6">Générez une clé API pour connecter Zapier à CloseOS.</p>
                          <button onClick={handleGenerateZapierKey} disabled={zapierLoading} className="px-6 py-3 bg-[#1b1c1b] text-white rounded-full font-bold text-sm flex items-center gap-2 hover:bg-[#1b1c1b]/80 transition-colors disabled:opacity-50">
                            {zapierLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
                            Générer une clé API
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="p-8 rounded-2xl bg-[#f5f3f2] dark:bg-neutral-800 border border-[#c4c7c7]/5 dark:border-neutral-700">
                            <h4 className="font-bold text-lg mb-4 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Webhook & API Access</h4>
                            <div className="space-y-5">
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-[#444748]/60 uppercase">Webhook URL</label>
                                <div className="flex gap-2">
                                  <input type="text" value={`${baseUrl}/api/zapier-webhook?type=business`} readOnly className={inputCls} />
                                  <button onClick={() => { navigator.clipboard.writeText(`${baseUrl}/api/zapier-webhook?type=business`); setZapierCopiedUrl(true); setTimeout(() => setZapierCopiedUrl(false), 2000); }} className="p-3 rounded-xl hover:bg-[#eae8e7] transition-colors shrink-0">
                                    {zapierCopiedUrl ? <Check className="h-4 w-4 text-[#006c49]" /> : <Copy className="h-4 w-4 text-[#444748]" />}
                                  </button>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-[#444748]/60 uppercase">API Key (Zapier)</label>
                                <div className="flex gap-2">
                                  <div className="relative flex-1">
                                    <input type={zapierShowKey ? 'text' : 'password'} value={zapierApiKey} readOnly className={inputCls + ' pr-9'} />
                                    <button onClick={() => setZapierShowKey(!zapierShowKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444748]/50 hover:text-[#1b1c1b]">
                                      {zapierShowKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                  </div>
                                  <button onClick={() => { navigator.clipboard.writeText(zapierApiKey!); setZapierCopiedKey(true); setTimeout(() => setZapierCopiedKey(false), 2000); }} className="p-3 rounded-xl hover:bg-[#eae8e7] transition-colors shrink-0">
                                    {zapierCopiedKey ? <Check className="h-4 w-4 text-[#006c49]" /> : <Copy className="h-4 w-4 text-[#444748]" />}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <button onClick={handleDeleteZapierKey} disabled={zapierLoading} className="text-xs text-[#444748] hover:text-[#ba1a1a] flex items-center gap-1 font-semibold transition-colors">
                              <Trash2 className="h-3 w-3" /> Supprimer la clé
                            </button>
                          </div>
                        </>
                      )}
                      <BusinessCRMAutoAssignBlock provider="zapier" providerLabel="Zapier" />
                    </div>
                  )}

                  {/* ─── Make Config ─── */}
                  {selected === 'make' && (
                    <div className="space-y-6">
                      {!makeApiKey ? (
                        <div className="p-8 rounded-2xl bg-[#f5f3f2] dark:bg-neutral-800 border border-[#c4c7c7]/5 dark:border-neutral-700">
                          <h4 className="font-bold text-lg mb-2 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Générer une clé API</h4>
                          <p className="text-[#444748] dark:text-neutral-300 text-sm mb-6">Générez une clé API pour connecter Make à CloseOS.</p>
                          <button onClick={handleGenerateMakeKey} disabled={makeLoading} className="px-6 py-3 bg-[#1b1c1b] text-white rounded-full font-bold text-sm flex items-center gap-2 hover:bg-[#1b1c1b]/80 transition-colors disabled:opacity-50">
                            {makeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
                            Générer une clé API
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="p-8 rounded-2xl bg-[#f5f3f2] dark:bg-neutral-800 border border-[#c4c7c7]/5 dark:border-neutral-700">
                            <h4 className="font-bold text-lg mb-4 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Webhook & API Access</h4>
                            <div className="space-y-5">
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-[#444748]/60 uppercase">Webhook URL (Make)</label>
                                <div className="flex gap-2">
                                  <input type="text" value={`${baseUrl}/api/zapier-webhook?type=business`} readOnly className={inputCls} />
                                  <button onClick={() => { navigator.clipboard.writeText(`${baseUrl}/api/zapier-webhook?type=business`); setMakeCopiedUrl(true); setTimeout(() => setMakeCopiedUrl(false), 2000); }} className="p-3 rounded-xl hover:bg-[#eae8e7] transition-colors shrink-0">
                                    {makeCopiedUrl ? <Check className="h-4 w-4 text-[#006c49]" /> : <Copy className="h-4 w-4 text-[#444748]" />}
                                  </button>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-[#444748]/60 uppercase">API Key (Make)</label>
                                <div className="flex gap-2">
                                  <div className="relative flex-1">
                                    <input type={makeShowKey ? 'text' : 'password'} value={makeApiKey} readOnly className={inputCls + ' pr-9'} />
                                    <button onClick={() => setMakeShowKey(!makeShowKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444748]/50 hover:text-[#1b1c1b]">
                                      {makeShowKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                  </div>
                                  <button onClick={() => { navigator.clipboard.writeText(makeApiKey!); setMakeCopiedKey(true); setTimeout(() => setMakeCopiedKey(false), 2000); }} className="p-3 rounded-xl hover:bg-[#eae8e7] transition-colors shrink-0">
                                    {makeCopiedKey ? <Check className="h-4 w-4 text-[#006c49]" /> : <Copy className="h-4 w-4 text-[#444748]" />}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <button onClick={handleDeleteMakeKey} disabled={makeLoading} className="text-xs text-[#444748] hover:text-[#ba1a1a] flex items-center gap-1 font-semibold transition-colors">
                              <Trash2 className="h-3 w-3" /> Supprimer la clé
                            </button>
                          </div>
                        </>
                      )}
                      <BusinessCRMAutoAssignBlock provider="make" providerLabel="Make" />
                    </div>
                  )}

                  {/* ─── n8n Config ─── */}
                  {selected === 'n8n' && (
                    <div className="space-y-6">
                      {!n8nApiKey ? (
                        <div className="p-8 rounded-2xl bg-[#f5f3f2] dark:bg-neutral-800 border border-[#c4c7c7]/5 dark:border-neutral-700">
                          <h4 className="font-bold text-lg mb-2 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Générer une clé API</h4>
                          <p className="text-[#444748] dark:text-neutral-300 text-sm mb-6">Générez une clé API pour connecter n8n à CloseOS. Les prospects seront importés directement dans votre pipeline.</p>
                          <button onClick={handleGenerateN8nKey} disabled={n8nLoading} className="px-6 py-3 bg-[#1b1c1b] text-white rounded-full font-bold text-sm flex items-center gap-2 hover:bg-[#1b1c1b]/80 transition-colors disabled:opacity-50">
                            {n8nLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
                            Générer une clé API
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="p-8 rounded-2xl bg-[#f5f3f2] dark:bg-neutral-800 border border-[#c4c7c7]/5 dark:border-neutral-700">
                            <h4 className="font-bold text-lg mb-4 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Webhook & API Access</h4>
                            <div className="space-y-5">
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-[#444748]/60 uppercase">Webhook URL (n8n)</label>
                                <div className="flex gap-2">
                                  <input type="text" value={`${baseUrl}/api/zapier-webhook?type=business`} readOnly className={inputCls} />
                                  <button onClick={() => { navigator.clipboard.writeText(`${baseUrl}/api/zapier-webhook?type=business`); setN8nCopiedUrl(true); setTimeout(() => setN8nCopiedUrl(false), 2000); }} className="p-3 rounded-xl hover:bg-[#eae8e7] transition-colors shrink-0">
                                    {n8nCopiedUrl ? <Check className="h-4 w-4 text-[#006c49]" /> : <Copy className="h-4 w-4 text-[#444748]" />}
                                  </button>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-[#444748]/60 uppercase">API Key (n8n)</label>
                                <div className="flex gap-2">
                                  <div className="relative flex-1">
                                    <input type={n8nShowKey ? 'text' : 'password'} value={n8nApiKey} readOnly className={inputCls + ' pr-9'} />
                                    <button onClick={() => setN8nShowKey(!n8nShowKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444748]/50 hover:text-[#1b1c1b]">
                                      {n8nShowKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                  </div>
                                  <button onClick={() => { navigator.clipboard.writeText(n8nApiKey!); setN8nCopiedKey(true); setTimeout(() => setN8nCopiedKey(false), 2000); }} className="p-3 rounded-xl hover:bg-[#eae8e7] transition-colors shrink-0">
                                    {n8nCopiedKey ? <Check className="h-4 w-4 text-[#006c49]" /> : <Copy className="h-4 w-4 text-[#444748]" />}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                          {/* Instructions */}
                          <div className="border-t border-[#c4c7c7]/10 dark:border-neutral-700 pt-6">
                            <h5 className="font-bold text-sm mb-4 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Instructions d'intégration</h5>
                            <ul className="space-y-4">
                              {[
                                'Créez un workflow n8n avec un nœud HTTP Request.',
                                'Méthode : POST, URL : collez l\'URL ci-dessus.',
                                'Authentication : Header Auth → Name: Authorization, Value: Bearer votre_clé.',
                                'Body (JSON) : firstName, lastName, email, phone, company, source.',
                              ].map((step, i) => (
                                <li key={i} className="flex gap-3 items-start">
                                  <span className="h-6 w-6 rounded-full bg-[#1b1c1b] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                                  <span className="text-sm text-[#444748] dark:text-neutral-300 font-medium" dangerouslySetInnerHTML={{ __html: step }} />
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="flex justify-end">
                            <button onClick={handleDeleteN8nKey} disabled={n8nLoading} className="text-xs text-[#444748] hover:text-[#ba1a1a] flex items-center gap-1 font-semibold transition-colors">
                              <Trash2 className="h-3 w-3" /> Supprimer la clé
                            </button>
                          </div>
                        </>
                      )}
                      <BusinessCRMAutoAssignBlock provider="n8n" providerLabel="n8n" />
                    </div>
                  )}

                  {/* ─── Calendly Config ─── */}
                  {selected === 'calendly' && (
                    <div className="space-y-6">
                      {!calendlyApiKey ? (
                        <div className="p-8 rounded-2xl bg-[#f5f3f2] dark:bg-neutral-800 border border-[#c4c7c7]/5 dark:border-neutral-700">
                          <h4 className="font-bold text-lg mb-2 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Générer une clé API</h4>
                          <p className="text-[#444748] dark:text-neutral-300 text-sm mb-6">Quand quelqu'un book un call, le prospect et le rendez-vous seront créés automatiquement.</p>
                          <button onClick={handleGenerateCalendlyKey} disabled={calendlyLoading} className="px-6 py-3 bg-[#1b1c1b] text-white rounded-full font-bold text-sm flex items-center gap-2 hover:bg-[#1b1c1b]/80 transition-colors disabled:opacity-50">
                            {calendlyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
                            Générer une clé API
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="p-8 rounded-2xl bg-[#f5f3f2] dark:bg-neutral-800 border border-[#c4c7c7]/5 dark:border-neutral-700">
                            <h4 className="font-bold text-lg mb-4 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Webhook & API Access</h4>
                            <div className="space-y-5">
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-[#444748]/60 uppercase">Webhook URL</label>
                                <div className="flex gap-2">
                                  <input type="text" value={`${baseUrl}/api/webhooks?action=calendly-webhook&api_key=${calendlyApiKey}`} readOnly className={inputCls} />
                                  <button onClick={() => { navigator.clipboard.writeText(`${baseUrl}/api/webhooks?action=calendly-webhook&api_key=${calendlyApiKey}`); setCalendlyCopiedUrl(true); setTimeout(() => setCalendlyCopiedUrl(false), 2000); }} className="p-3 rounded-xl hover:bg-[#eae8e7] transition-colors shrink-0">
                                    {calendlyCopiedUrl ? <Check className="h-4 w-4 text-[#006c49]" /> : <Copy className="h-4 w-4 text-[#444748]" />}
                                  </button>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-[#444748]/60 uppercase">API Key</label>
                                <div className="flex gap-2">
                                  <div className="relative flex-1">
                                    <input type={calendlyShowKey ? 'text' : 'password'} value={calendlyApiKey} readOnly className={inputCls + ' pr-9'} />
                                    <button onClick={() => setCalendlyShowKey(!calendlyShowKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444748]/50 hover:text-[#1b1c1b]">
                                      {calendlyShowKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                  </div>
                                  <button onClick={() => { navigator.clipboard.writeText(calendlyApiKey!); setCalendlyCopiedKey(true); setTimeout(() => setCalendlyCopiedKey(false), 2000); }} className="p-3 rounded-xl hover:bg-[#eae8e7] transition-colors shrink-0">
                                    {calendlyCopiedKey ? <Check className="h-4 w-4 text-[#006c49]" /> : <Copy className="h-4 w-4 text-[#444748]" />}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                          {/* Instructions */}
                          <div className="border-t border-[#c4c7c7]/10 dark:border-neutral-700 pt-6">
                            <h5 className="font-bold text-sm mb-4 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Instructions d'intégration</h5>
                            <ul className="space-y-4">
                              {[
                                'Allez dans Calendly → Integrations → Webhooks (ou Developer).',
                                'Cliquez "Add Webhook" et collez l\'URL ci-dessus.',
                                'Sélectionnez les événements : invitee.created et invitee.canceled.',
                              ].map((text, i) => (
                                <li key={i} className="flex items-start gap-3">
                                  <span className="w-5 h-5 rounded-full bg-[#efedec] text-[10px] font-bold flex items-center justify-center mt-0.5 shrink-0">{i + 1}</span>
                                  <p className="text-sm text-[#444748]">{text}</p>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="p-4 rounded-2xl bg-[#ffb95f]/10 border border-[#ffb95f]/20">
                            <p className="text-[11px] text-[#b87500] font-medium">
                              Important : chaque membre doit être inscrit sur CloseOS avec <strong>le même email que son compte Calendly</strong>.
                            </p>
                          </div>
                          <div className="flex justify-end">
                            <button onClick={handleDeleteCalendlyKey} disabled={calendlyLoading} className="text-xs text-[#444748] hover:text-[#ba1a1a] flex items-center gap-1 font-semibold transition-colors">
                              <Trash2 className="h-3 w-3" /> Supprimer la clé
                            </button>
                          </div>
                        </>
                      )}
                      <BusinessCRMAutoAssignBlock provider="calendly" providerLabel="Calendly" />
                    </div>
                  )}

                  {/* ─── Airtable Config ─── */}
                  {selected === 'airtable' && (
                    <div className="space-y-6">
                      {!airtableConnected ? (
                        <div className="p-8 rounded-2xl bg-[#f5f3f2] dark:bg-neutral-800 border border-[#c4c7c7]/5 dark:border-neutral-700">
                          <h4 className="font-bold text-lg mb-2 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Connexion</h4>
                          <p className="text-[#444748] dark:text-neutral-300 text-sm mb-6">Connectez votre compte Airtable pour synchroniser vos enregistrements comme prospects.</p>
                          <button onClick={handleConnectAirtable} className="px-6 py-3 bg-[#1b1c1b] text-white rounded-full font-bold text-sm flex items-center gap-2 hover:bg-[#1b1c1b]/80 transition-colors">
                            <LinkIcon className="h-4 w-4" /> Connecter Airtable
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="p-8 rounded-2xl bg-[#f5f3f2] dark:bg-neutral-800 border border-[#c4c7c7]/5 dark:border-neutral-700">
                            <h4 className="font-bold text-lg mb-2 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Statut de la Synchronisation</h4>
                            <div className="flex gap-4 flex-wrap mt-4">
                              <button onClick={handleSyncAirtable} disabled={isSyncingAirtable || !airtableBaseId || !airtableTableId} className="px-6 py-3 bg-[#1b1c1b] text-white rounded-full font-bold text-sm flex items-center gap-2 hover:bg-[#1b1c1b]/80 transition-colors disabled:opacity-50">
                                {isSyncingAirtable ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                Synchroniser maintenant
                              </button>
                              <button onClick={handleDisconnectAirtable} className="px-6 py-3 border border-[#c4c7c7]/30 rounded-full font-bold text-sm text-[#444748] hover:bg-[#f5f3f2] transition-colors">
                                Déconnecter
                              </button>
                            </div>
                          </div>
                          {syncResult && (
                            <div className="p-4 rounded-2xl bg-[#006c49]/5 border border-[#006c49]/10 text-sm text-[#006c49] font-medium">
                              {syncResult.imported} enregistrements importés, {syncResult.updated} mis à jour
                            </div>
                          )}
                          {/* Base + Table selectors */}
                          <div className="p-8 rounded-2xl bg-[#f5f3f2]/50 dark:bg-neutral-800/50 border border-[#c4c7c7]/10 dark:border-neutral-700">
                            <h4 className="font-extrabold text-xl mb-6 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Configuration Airtable</h4>
                            <div className="grid grid-cols-2 gap-6">
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-[#444748]/60 uppercase tracking-tighter">Base</label>
                                {airtableLoadingBases ? (
                                  <div className="flex items-center gap-2 text-xs text-[#444748]"><Loader2 className="h-3 w-3 animate-spin" /> Chargement...</div>
                                ) : (
                                  <select value={airtableBaseId} onChange={(e) => { setAirtableBaseId(e.target.value); setAirtableTableId(''); setAirtableFields([]); }} className={selectCls}>
                                    <option value="">Sélectionner</option>
                                    {airtableBases.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                  </select>
                                )}
                              </div>
                              {airtableBaseId && (
                                <div className="space-y-2">
                                  <label className="text-xs font-bold text-[#444748]/60 uppercase tracking-tighter">Table</label>
                                  {airtableLoadingTables ? (
                                    <div className="flex items-center gap-2 text-xs text-[#444748]"><Loader2 className="h-3 w-3 animate-spin" /> Chargement...</div>
                                  ) : (
                                    <select value={airtableTableId} onChange={(e) => { setAirtableTableId(e.target.value); setAirtableFields([]); }} className={selectCls}>
                                      <option value="">Sélectionner</option>
                                      {airtableTables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          {/* Field mapping */}
                          {airtableTableId && airtableFields.length > 0 && (
                            <div className="p-8 rounded-2xl bg-[#f5f3f2]/50 dark:bg-neutral-800/50 border border-[#c4c7c7]/10 dark:border-neutral-700">
                              <h4 className="font-extrabold text-xl mb-6 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Mapping des champs</h4>
                              {airtableLoadingFields ? (
                                <div className="flex items-center gap-2 text-xs text-[#444748]"><Loader2 className="h-3 w-3 animate-spin" /> Chargement...</div>
                              ) : (
                                <div className="grid grid-cols-2 gap-6">
                                  {['firstName', 'lastName', 'email', 'phone', 'company', 'stage', 'value'].map(field => (
                                    <div key={field} className="space-y-2">
                                      <label className="text-xs font-bold text-[#444748]/60 uppercase tracking-tighter">
                                        {field === 'firstName' ? 'Prénom' : field === 'lastName' ? 'Nom' : field === 'email' ? 'Email' : field === 'phone' ? 'Téléphone' : field === 'company' ? 'Entreprise' : field === 'stage' ? 'Étape' : 'Valeur'}
                                      </label>
                                      <select value={airtableFieldMapping[field] || ''} onChange={(e) => setAirtableFieldMapping(prev => ({ ...prev, [field]: e.target.value }))} className={selectCls}>
                                        <option value="">— Non mappé —</option>
                                        {airtableFields.map(f => <option key={f.id} value={f.name}>{f.name} ({f.type})</option>)}
                                      </select>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          {/* Stage mapping */}
                          {airtableFieldMapping.stage && (
                            <div className="p-8 rounded-2xl bg-[#f5f3f2]/50 dark:bg-neutral-800/50 border border-[#c4c7c7]/10 dark:border-neutral-700">
                              <h4 className="font-extrabold text-xl mb-6 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Mapping des étapes</h4>
                              <div className="grid grid-cols-2 gap-6">
                                {CLOSEOS_STAGES.map(stage => (
                                  <div key={stage.id} className="space-y-2">
                                    <label className="text-xs font-bold text-[#444748]/60 uppercase tracking-tighter">{stage.name}</label>
                                    <input
                                      type="text"
                                      value={airtableStageMapping[stage.id] || ''}
                                      onChange={(e) => setAirtableStageMapping(prev => ({ ...prev, [stage.id]: e.target.value }))}
                                      placeholder={stage.name}
                                      className={selectCls}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Save config */}
                          {airtableTableId && (
                            <button onClick={handleSaveAirtableConfig} disabled={airtableSavingConfig} className="w-full flex items-center justify-center gap-2 py-3 bg-[#1b1c1b] text-white rounded-full font-bold text-sm hover:bg-[#1b1c1b]/80 transition-colors disabled:opacity-50">
                              {airtableSavingConfig ? <><Loader2 className="h-4 w-4 animate-spin" /> Enregistrement...</> : <><Save className="h-4 w-4" /> Sauvegarder la configuration</>}
                            </button>
                          )}
                        </>
                      )}
                      <BusinessCRMAutoAssignBlock provider="airtable" providerLabel="Airtable" />
                    </div>
                  )}
                  {/* ─── GHL Config ─── */}
                  {selected === 'ghl' && (
                    <div className="space-y-6">
                      {!ghlConnected ? (
                        <div className="p-8 rounded-2xl bg-[#f5f3f2] dark:bg-neutral-800 border border-[#c4c7c7]/5 dark:border-neutral-700">
                          <h4 className="font-bold text-lg mb-2 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Connexion</h4>
                          <p className="text-[#444748] dark:text-neutral-300 text-sm mb-6">Connectez votre compte GoHighLevel pour synchroniser vos contacts et opportunités.</p>
                          <button onClick={handleConnectGhl} className="px-6 py-3 bg-[#1b1c1b] text-white rounded-full font-bold text-sm flex items-center gap-2 hover:bg-[#1b1c1b]/80 transition-colors">
                            <LinkIcon className="h-4 w-4" /> Connecter GoHighLevel
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="p-8 rounded-2xl bg-[#f5f3f2] dark:bg-neutral-800 border border-[#c4c7c7]/5 dark:border-neutral-700">
                            <h4 className="font-bold text-lg mb-2 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Statut de la Synchronisation</h4>
                            <p className="text-[#444748] dark:text-neutral-300 text-sm mb-6">La synchronisation auto se fait toutes les 2 minutes.</p>
                            <div className="flex gap-4 flex-wrap">
                              <button onClick={handleSyncGhl} disabled={isSyncingGhl} className="px-6 py-3 bg-[#1b1c1b] text-white rounded-full font-bold text-sm flex items-center gap-2 hover:bg-[#1b1c1b]/80 transition-colors disabled:opacity-50">
                                {isSyncingGhl ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                Synchroniser maintenant
                              </button>
                              <button onClick={handleDisconnectGhl} className="px-6 py-3 border border-[#c4c7c7]/30 rounded-full font-bold text-sm text-[#444748] hover:bg-[#f5f3f2] transition-colors">
                                Déconnecter
                              </button>
                            </div>
                          </div>
                          {syncResult && (
                            <div className="p-4 rounded-2xl bg-[#006c49]/5 border border-[#006c49]/10 text-sm text-[#006c49] font-medium">
                              {syncResult.imported} contacts importés, {syncResult.updated} mis à jour
                            </div>
                          )}
                          {/* Pipeline selection + Stage mapping */}
                          <div className="p-8 rounded-2xl bg-[#f5f3f2]/50 dark:bg-neutral-800/50 border border-[#c4c7c7]/10 dark:border-neutral-700">
                            <h4 className="font-extrabold text-xl mb-6 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Pipeline & Mapping</h4>
                            {ghlLoadingPipelines ? (
                              <div className="flex items-center gap-2 text-sm text-[#444748]"><Loader2 className="h-4 w-4 animate-spin" /> Chargement...</div>
                            ) : (
                              <div className="space-y-6">
                                <div className="space-y-2">
                                  <label className="text-xs font-bold text-[#444748]/60 uppercase tracking-tighter">Pipeline</label>
                                  <select
                                    value={ghlSelectedPipeline}
                                    onChange={(e) => handleGhlPipelineChange(e.target.value)}
                                    className={selectCls}
                                  >
                                    <option value="">Sélectionner un pipeline</option>
                                    {ghlPipelines.map((p: any) => (
                                      <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                  </select>
                                </div>
                                {ghlSelectedPipeline && (
                                  <div className="grid grid-cols-2 gap-6">
                                    {CLOSEOS_STAGES.map(stage => (
                                      <div key={stage.id} className="space-y-2">
                                        <label className="text-xs font-bold text-[#444748]/60 uppercase tracking-tighter">{stage.name}</label>
                                        <select
                                          value={ghlMappings[stage.id] || ''}
                                          onChange={(e) => handleUpdateGhlMapping(stage.id, e.target.value)}
                                          className={selectCls}
                                        >
                                          <option value="">Sélectionner une étape</option>
                                          {ghlStages.filter((s: any) => s.pipeline_id === ghlSelectedPipeline).map((s: any) => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                          ))}
                                        </select>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                      <BusinessCRMAutoAssignBlock provider="ghl" providerLabel="GoHighLevel" />
                    </div>
                  )}

                  {/* ─── CSV Import / Export ─── */}
                  {selected === 'csv' && (
                    <div className="space-y-6">
                      {/* Export */}
                      <div className="p-8 rounded-2xl bg-[#f5f3f2] dark:bg-neutral-800 border border-[#c4c7c7]/5 dark:border-neutral-700">
                        <div className="flex items-center gap-3 mb-3">
                          <Download className="h-5 w-5 text-[#006c49]" />
                          <h4 className="font-bold text-lg text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Exporter le CRM</h4>
                        </div>
                        <p className="text-[#444748] dark:text-neutral-300 text-sm mb-5">Téléchargez tous vos prospects au format CSV ({prospects.length} prospect{prospects.length > 1 ? 's' : ''}).</p>
                        <button
                          onClick={handleCsvExport}
                          disabled={prospects.length === 0}
                          className="px-6 py-3 bg-[#1b1c1b] text-white rounded-full font-bold text-sm flex items-center gap-2 hover:bg-[#1b1c1b]/80 transition-colors disabled:opacity-50"
                        >
                          <FileSpreadsheet className="h-4 w-4" /> Exporter en CSV
                        </button>
                      </div>

                      {/* Import */}
                      <div className="p-8 rounded-2xl bg-[#f5f3f2] dark:bg-neutral-800 border border-[#c4c7c7]/5 dark:border-neutral-700">
                        <div className="flex items-center gap-3 mb-3">
                          <Upload className="h-5 w-5 text-[#006c49]" />
                          <h4 className="font-bold text-lg text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Importer des prospects</h4>
                        </div>
                        <p className="text-[#444748] dark:text-neutral-300 text-sm mb-4">Importez un fichier CSV pour créer des prospects dans votre CRM.</p>

                        <input
                          ref={csvFileRef}
                          type="file"
                          accept=".csv"
                          className="hidden"
                          onChange={(e) => { if (e.target.files?.[0]) handleCsvImport(e.target.files[0]) }}
                        />
                        <button
                          onClick={() => csvFileRef.current?.click()}
                          disabled={csvImporting}
                          className="px-6 py-3 bg-[#1b1c1b] text-white rounded-full font-bold text-sm flex items-center gap-2 hover:bg-[#1b1c1b]/80 transition-colors disabled:opacity-50 mb-5"
                        >
                          {csvImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                          {csvImporting ? 'Import en cours...' : 'Choisir un fichier CSV'}
                        </button>

                        {csvResult && (
                          <div className="p-4 rounded-xl bg-[#006c49]/5 border border-[#006c49]/10 text-sm space-y-1 mb-5">
                            <p className="text-[#006c49] font-bold">{csvResult.imported} prospect{csvResult.imported > 1 ? 's' : ''} importé{csvResult.imported > 1 ? 's' : ''}</p>
                            {csvResult.skipped > 0 && <p className="text-[#444748]">{csvResult.skipped} ligne{csvResult.skipped > 1 ? 's' : ''} ignorée{csvResult.skipped > 1 ? 's' : ''} (données manquantes)</p>}
                            {csvResult.defaulted > 0 && <p className="text-amber-600 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> {csvResult.defaulted} statut{csvResult.defaulted > 1 ? 's' : ''} non reconnu{csvResult.defaulted > 1 ? 's' : ''} → mis en "Prospect"</p>}
                          </div>
                        )}

                        {/* Warning */}
                        <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 flex gap-3 mb-5">
                          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                          <p className="text-xs text-[#444748] dark:text-neutral-400">
                            Les statuts non reconnus seront automatiquement assignés au statut <strong>"Prospect"</strong>. Utilisez de préférence les statuts exacts : <span className="font-mono text-[10px]">prospect, qualified, won, followup, noshow, lost</span>
                          </p>
                        </div>

                        {/* Format guide */}
                        <div className="p-5 rounded-xl bg-white dark:bg-neutral-900 border border-[#c4c7c7]/10 dark:border-neutral-700">
                          <h5 className="font-bold text-sm text-[#1b1c1b] dark:text-white mb-3" style={{ fontFamily: 'Manrope, sans-serif' }}>Format attendu du CSV</h5>
                          <div className="overflow-x-auto mb-4">
                            <table className="text-[11px] font-mono text-[#444748] dark:text-neutral-400 border-collapse w-full">
                              <thead>
                                <tr className="border-b border-[#c4c7c7]/20 dark:border-neutral-700">
                                  <th className="text-left py-1.5 px-2 font-bold text-[#1b1c1b] dark:text-white">Colonne</th>
                                  <th className="text-left py-1.5 px-2 font-bold text-[#1b1c1b] dark:text-white">Obligatoire</th>
                                  <th className="text-left py-1.5 px-2 font-bold text-[#1b1c1b] dark:text-white">Exemple</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="border-b border-[#c4c7c7]/10 dark:border-neutral-800"><td className="py-1.5 px-2 font-bold">contact</td><td className="py-1.5 px-2 text-[#006c49]">Oui*</td><td className="py-1.5 px-2">Jean Dupont</td></tr>
                                <tr className="border-b border-[#c4c7c7]/10 dark:border-neutral-800"><td className="py-1.5 px-2 font-bold">email</td><td className="py-1.5 px-2 text-[#006c49]">Oui*</td><td className="py-1.5 px-2">jean@example.com</td></tr>
                                <tr className="border-b border-[#c4c7c7]/10 dark:border-neutral-800"><td className="py-1.5 px-2 font-bold">phone</td><td className="py-1.5 px-2">Non</td><td className="py-1.5 px-2">+33 6 12 34 56 78</td></tr>
                                <tr className="border-b border-[#c4c7c7]/10 dark:border-neutral-800"><td className="py-1.5 px-2 font-bold">company</td><td className="py-1.5 px-2">Non</td><td className="py-1.5 px-2">Acme SAS</td></tr>
                                <tr className="border-b border-[#c4c7c7]/10 dark:border-neutral-800"><td className="py-1.5 px-2 font-bold">stage</td><td className="py-1.5 px-2">Non</td><td className="py-1.5 px-2">prospect, qualified, won, followup, noshow, lost</td></tr>
                                <tr className="border-b border-[#c4c7c7]/10 dark:border-neutral-800"><td className="py-1.5 px-2 font-bold">value</td><td className="py-1.5 px-2">Non</td><td className="py-1.5 px-2">1500</td></tr>
                                <tr className="border-b border-[#c4c7c7]/10 dark:border-neutral-800"><td className="py-1.5 px-2 font-bold">offer</td><td className="py-1.5 px-2">Non</td><td className="py-1.5 px-2">Coaching Premium</td></tr>
                                <tr><td className="py-1.5 px-2 font-bold">notes</td><td className="py-1.5 px-2">Non</td><td className="py-1.5 px-2">Intéressé par l'offre</td></tr>
                              </tbody>
                            </table>
                          </div>
                          <p className="text-[10px] text-[#747878] dark:text-neutral-500 mb-1">* Au moins "contact" ou "email" est requis. Les noms de colonnes sont flexibles (ex: "nom", "name", "téléphone", "statut"...).</p>
                          <p className="text-[10px] text-[#747878] dark:text-neutral-500">Séparateur : virgule ou point-virgule. Encodage : UTF-8.</p>
                        </div>
                      </div>

                      {/* AI Prompt helper */}
                      <div className="p-8 rounded-2xl bg-gradient-to-br from-[#006c49]/5 to-[#006c49]/0 dark:from-emerald-900/10 dark:to-transparent border border-[#006c49]/10 dark:border-emerald-900/20">
                        <div className="flex items-center gap-3 mb-3">
                          <Sparkles className="h-5 w-5 text-[#006c49]" />
                          <h4 className="font-bold text-lg text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>CSV pas au bon format ?</h4>
                        </div>
                        <p className="text-[#444748] dark:text-neutral-300 text-sm mb-4">
                          Si votre CSV vient d'un autre CRM ou a un format différent, copiez ce prompt et collez-le dans <strong>ChatGPT</strong>, <strong>Claude</strong> ou toute autre IA avec votre fichier CSV. L'IA reformatera automatiquement votre fichier pour qu'il soit compatible.
                        </p>
                        <div className="relative">
                          <pre className="p-4 rounded-xl bg-[#1b1c1b] text-[#a3e635] text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">{CSV_AI_PROMPT}</pre>
                          <button
                            onClick={() => { navigator.clipboard.writeText(CSV_AI_PROMPT); setCsvPromptCopied(true); setTimeout(() => setCsvPromptCopied(false), 2000); toast.success('Prompt copié !') }}
                            className="absolute top-3 right-3 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                          >
                            {csvPromptCopied ? <Check className="h-4 w-4 text-[#a3e635]" /> : <Copy className="h-4 w-4 text-white/60" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-8 py-6 bg-[#f5f3f2] dark:bg-neutral-900 border-t border-[#c4c7c7]/10 dark:border-neutral-700 flex justify-end gap-4 flex-shrink-0">
          <button onClick={onClose} className="px-10 py-3 rounded-full font-bold text-sm text-[#444748] dark:text-neutral-300 hover:bg-[#eae8e7] dark:hover:bg-neutral-800 transition-colors" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Fermer
          </button>
          <button onClick={handleSave} disabled={saving} className="px-10 py-3 rounded-full font-bold text-sm bg-[#1b1c1b] text-white shadow-xl shadow-black/10 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
