import { useState, useEffect } from 'react';
import { X, Check, ExternalLink, Loader2, RefreshCw, Link as LinkIcon, Copy, Info, ChevronDown, Key, Trash2, Zap, Eye, EyeOff, CalendarDays, Save } from 'lucide-react';
import { useBusinessAuth } from '../contexts/BusinessAuthContext';
import { useBusinessProspects } from '../contexts/BusinessProspectsContext';
import { supabase } from '../../lib/supabase';

const CRM_OPTIONS = [
  { id: 'closeos', name: 'CloseOS', description: 'CRM intégré CloseOS', color: 'bg-amber-500', textColor: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-300', iconBg: 'bg-[#1b1c1b]', iconText: 'text-white' },
  { id: 'iclosed', name: 'iClosed', description: 'Connectez via Webhook', color: 'bg-purple-500', textColor: 'text-purple-700', bgColor: 'bg-purple-50', borderColor: 'border-purple-300', iconBg: 'bg-emerald-100', iconText: 'text-emerald-700' },
  { id: 'hubspot', name: 'HubSpot', description: 'Synchronisez avec HubSpot CRM', color: 'bg-orange-500', textColor: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-300', iconBg: 'bg-[#ff7a59]', iconText: 'text-white' },
  { id: 'pipedrive', name: 'Pipedrive', description: 'Connectez votre pipeline Pipedrive', color: 'bg-green-500', textColor: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-300', iconBg: 'bg-[#222222]', iconText: 'text-white' },
  { id: 'systemeio', name: 'Systeme.io', description: 'Importez vos contacts Systeme.io', color: 'bg-blue-500', textColor: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-300', iconBg: 'bg-[#00a1d4]', iconText: 'text-white' },
  { id: 'zapier', name: 'Zapier', description: 'Importez des prospects via Zapier (webhook)', color: 'bg-[#FF4A00]', textColor: 'text-[#FF4A00]', bgColor: 'bg-orange-50', borderColor: 'border-orange-300', iconBg: 'bg-[#ff4a00]', iconText: 'text-white' },
  { id: 'calendly', name: 'Calendly', description: 'Importez les RDV Calendly automatiquement', color: 'bg-[#006BFF]', textColor: 'text-[#006BFF]', bgColor: 'bg-blue-50', borderColor: 'border-blue-300', iconBg: 'bg-[#006bff]', iconText: 'text-white' },
  { id: 'airtable', name: 'Airtable', description: 'Synchronisez avec votre base Airtable', color: 'bg-[#18BFFF]', textColor: 'text-[#18BFFF]', bgColor: 'bg-cyan-50', borderColor: 'border-cyan-300', iconBg: 'bg-[#18bfff]', iconText: 'text-white' },
];

const CLOSEOS_STAGES = [
  { id: 'prospect', name: 'Prospect' },
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
  const { user, businessSettings, updateBusinessSettings } = useBusinessAuth();
  const { syncHubspot, syncPipedrive, syncAirtable, isSyncingHubspot, isSyncingPipedrive, isSyncingAirtable, hubspotConnected, pipedriveConnected, airtableConnected } = useBusinessProspects();

  const [selected, setSelected] = useState(businessSettings?.crm_provider || 'closeos');
  const [saving, setSaving] = useState(false);
  const [syncResult, setSyncResult] = useState<{ imported: number; updated: number } | null>(null);

  // iClosed webhook
  const [webhookCopied, setWebhookCopied] = useState(false);

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
        .single();
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
        .single();
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
        .single();
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
  }, [airtableBaseId, airtableConnected, user]);

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
  }, [airtableBaseId, airtableTableId, airtableConnected, user]);

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

  if (!isOpen) return null;

  const baseUrl = window.location.origin.includes('localhost') ? 'https://closeos.fr' : window.location.origin;
  const webhookUrl = `${baseUrl}/api/webhook?source=business&user_id=${user?.id}`;
  const systemeioWebhookUrl = `${baseUrl}/api/systemeio?action=webhook&type=business&user_id=${user?.id}`;

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

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setWebhookCopied(true);
    setTimeout(() => setWebhookCopied(false), 2000);
  };

  const selectedCrm = CRM_OPTIONS.find(c => c.id === selected);
  const isConnected = (selected === 'hubspot' && hubspotConnected) ||
    (selected === 'pipedrive' && pipedriveConnected) ||
    (selected === 'airtable' && airtableConnected) ||
    (selected === 'zapier' && !!zapierApiKey) ||
    (selected === 'calendly' && !!calendlyApiKey) ||
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
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar — CRM Selection */}
          <div className="w-72 bg-[#f5f3f2] dark:bg-neutral-900 border-r border-[#c4c7c7]/10 dark:border-neutral-700 overflow-y-auto p-4 space-y-2 flex-shrink-0">
            <label className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#444748]/50 block">Available Integrations</label>
            {CRM_OPTIONS.map((crm) => {
              const isActive = selected === crm.id;
              const isCrmConnected = (crm.id === 'hubspot' && hubspotConnected) ||
                (crm.id === 'pipedrive' && pipedriveConnected) ||
                (crm.id === 'airtable' && airtableConnected) ||
                (crm.id === 'zapier' && !!zapierApiKey) ||
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
                  <div className={`w-10 h-10 rounded-xl ${crm.iconBg} ${crm.iconText} flex items-center justify-center shrink-0`}>
                    <span className="font-bold text-sm">{crm.name[0]}</span>
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
                  <div className={`w-20 h-20 rounded-2xl ${selectedCrm.iconBg} ${selectedCrm.iconText} flex items-center justify-center shadow-xl`} style={{ boxShadow: `0 10px 30px ${selectedCrm.iconBg.includes('#ff7a59') ? 'rgba(255,122,89,0.2)' : selectedCrm.iconBg.includes('#ff4a00') ? 'rgba(255,74,0,0.2)' : selectedCrm.iconBg.includes('#006bff') ? 'rgba(0,107,255,0.2)' : selectedCrm.iconBg.includes('#18bfff') ? 'rgba(24,191,255,0.2)' : 'rgba(27,28,27,0.1)'}` }}>
                    <span className="font-extrabold text-2xl">{selectedCrm.name[0]}</span>
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
                  {/* ─── CloseOS ─── */}
                  {selected === 'closeos' && (
                    <div className="p-8 rounded-2xl bg-[#f5f3f2] dark:bg-neutral-800 border border-[#c4c7c7]/5 dark:border-neutral-700">
                      <h4 className="font-bold text-lg mb-2 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>CRM Intégré</h4>
                      <p className="text-[#444748] dark:text-neutral-300 text-sm">Le CRM natif CloseOS est activé par défaut. Aucune configuration nécessaire.</p>
                    </div>
                  )}

                  {/* ─── iClosed Config ─── */}
                  {selected === 'iclosed' && (
                    <div className="space-y-6">
                      <div className="p-8 rounded-2xl bg-[#f5f3f2] dark:bg-neutral-800 border border-[#c4c7c7]/5 dark:border-neutral-700">
                        <h4 className="font-bold text-lg mb-2 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Webhook URL</h4>
                        <p className="text-[#444748] dark:text-neutral-300 text-sm mb-4">Collez cette URL dans <strong>iClosed → Paramètres → Développeur → Webhooks</strong></p>
                        <div className="flex gap-2">
                          <input type="text" value={webhookUrl} readOnly className={inputCls} />
                          <button onClick={handleCopyWebhook} className="p-3 rounded-xl bg-[#1b1c1b] text-white hover:bg-[#1b1c1b]/80 transition-colors shrink-0">
                            {webhookCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
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
