import { useState, useEffect } from 'react';
import { X, Check, ExternalLink, Loader2, RefreshCw, Link as LinkIcon, Copy, Info, ChevronDown, Key, Trash2, Zap, Eye, EyeOff } from 'lucide-react';
import { useBusinessAuth } from '../contexts/BusinessAuthContext';
import { useBusinessProspects } from '../contexts/BusinessProspectsContext';
import { supabase } from '../../lib/supabase';

const CRM_OPTIONS = [
  { id: 'closeos', name: 'CloseOS', description: 'CRM intégré CloseOS', color: 'bg-amber-500', textColor: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-300' },
  { id: 'iclosed', name: 'iClosed', description: 'Connectez via Webhook', color: 'bg-purple-500', textColor: 'text-purple-700', bgColor: 'bg-purple-50', borderColor: 'border-purple-300' },
  { id: 'hubspot', name: 'HubSpot', description: 'Synchronisez avec HubSpot CRM', color: 'bg-orange-500', textColor: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-300' },
  { id: 'pipedrive', name: 'Pipedrive', description: 'Connectez votre pipeline Pipedrive', color: 'bg-green-500', textColor: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-300' },
  { id: 'zapier', name: 'Zapier', description: 'Importez des prospects via Zapier (webhook)', color: 'bg-[#FF4A00]', textColor: 'text-[#FF4A00]', bgColor: 'bg-orange-50', borderColor: 'border-orange-300' },
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
  const { syncHubspot, syncPipedrive, isSyncingHubspot, isSyncingPipedrive, hubspotConnected, pipedriveConnected } = useBusinessProspects();

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-amber-200 bg-white p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors">
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-xl font-bold text-slate-900 mb-2">Intégration CRM</h2>
        <p className="text-slate-500 text-sm mb-6">Choisissez et configurez votre CRM.</p>

        {/* CRM Selection */}
        <div className="space-y-2 mb-6">
          {CRM_OPTIONS.map((crm) => (
            <button
              key={crm.id}
              onClick={() => { setSelected(crm.id); setSyncResult(null); }}
              className={`w-full flex items-center gap-4 rounded-xl border p-3 transition-all text-left ${
                selected === crm.id ? `${crm.borderColor} ${crm.bgColor}` : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className={`h-9 w-9 rounded-lg ${crm.color} flex items-center justify-center shrink-0`}>
                <span className="text-white font-bold text-sm">{crm.name[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm ${selected === crm.id ? crm.textColor : 'text-slate-800'}`}>{crm.name}</p>
                <p className="text-xs text-slate-500">{crm.description}</p>
              </div>
              {selected === crm.id && <Check className={`h-5 w-5 shrink-0 ${crm.textColor}`} />}
            </button>
          ))}
        </div>

        {/* ─── iClosed Config ─── */}
        {selected === 'iclosed' && (
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 mb-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-purple-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-purple-900">Configuration Webhook iClosed</h4>
                <p className="mt-1 text-xs text-purple-700/80 leading-relaxed">
                  Allez dans <strong>iClosed &gt; Paramètres &gt; Développeur &gt; Webhooks</strong> et collez l'URL ci-dessous.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="text"
                    value={webhookUrl}
                    readOnly
                    className="flex-1 rounded-lg border border-purple-200 bg-white py-2 px-3 text-xs text-slate-700 font-mono"
                  />
                  <button
                    onClick={handleCopyWebhook}
                    className="rounded-lg bg-purple-600 p-2 text-white hover:bg-purple-500 transition-colors"
                  >
                    {webhookCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── HubSpot Config ─── */}
        {selected === 'hubspot' && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 mb-4">
            <h4 className="text-sm font-semibold text-orange-900 mb-3 flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              Configuration HubSpot
            </h4>

            {!hubspotConnected ? (
              <div>
                <p className="text-xs text-orange-700/80 leading-relaxed mb-3">
                  Connectez votre compte HubSpot pour synchroniser automatiquement vos contacts.
                </p>
                <button
                  onClick={handleConnectHubspot}
                  className="w-full flex justify-center items-center gap-2 rounded-xl bg-orange-600 py-3 text-sm font-bold text-white hover:bg-orange-500 transition-all"
                >
                  <LinkIcon className="h-4 w-4" />
                  Connecter HubSpot
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Connected status */}
                <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-700">HubSpot Connecté</span>
                  </div>
                  <button onClick={handleDisconnectHubspot} className="text-xs text-slate-500 hover:text-red-500 underline">Déconnecter</button>
                </div>

                {/* Sync button */}
                <button
                  onClick={handleSyncHubspot}
                  disabled={isSyncingHubspot}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-orange-300 bg-orange-100 py-2.5 text-sm font-semibold text-orange-800 hover:bg-orange-200 transition-all disabled:opacity-50"
                >
                  {isSyncingHubspot ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Synchronisation en cours...</>
                  ) : (
                    <><RefreshCw className="h-4 w-4" /> Synchroniser les contacts HubSpot</>
                  )}
                </button>

                {/* Sync result */}
                {syncResult && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700 font-medium">
                    {syncResult.imported} contacts importés, {syncResult.updated} mis à jour
                  </div>
                )}

                <p className="text-[10px] text-orange-600/70">
                  La synchronisation auto se fait toutes les 2 minutes. Les changements de stage sont poussés vers HubSpot.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ─── Zapier Config ─── */}
        {selected === 'zapier' && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 mb-4">
            <h4 className="text-sm font-semibold text-[#FF4A00] mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Configuration Zapier
            </h4>

            {!zapierApiKey ? (
              <div>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  Générez une clé API pour connecter Zapier à CloseOS. Les prospects créés via Zapier seront visibles par toute votre équipe.
                </p>
                <button
                  onClick={handleGenerateZapierKey}
                  disabled={zapierLoading}
                  className="w-full flex justify-center items-center gap-2 rounded-xl bg-[#FF4A00] py-3 text-sm font-bold text-white hover:bg-[#e04300] transition-all disabled:opacity-50"
                >
                  {zapierLoading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Génération...</>
                  ) : (
                    <><Key className="h-4 w-4" /> Générer une clé API</>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Connected status */}
                <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-700">Clé API active</span>
                  </div>
                  <button
                    onClick={handleDeleteZapierKey}
                    disabled={zapierLoading}
                    className="text-xs text-slate-500 hover:text-red-500 underline flex items-center gap-1"
                  >
                    <Trash2 className="h-3 w-3" /> Supprimer
                  </button>
                </div>

                {/* Webhook URL */}
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">URL du Webhook</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={`${baseUrl}/api/zapier-webhook`}
                      readOnly
                      className="flex-1 rounded-lg border border-orange-200 bg-white py-2 px-3 text-xs text-slate-700 font-mono"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${baseUrl}/api/zapier-webhook`);
                        setZapierCopiedUrl(true);
                        setTimeout(() => setZapierCopiedUrl(false), 2000);
                      }}
                      className="rounded-lg bg-[#FF4A00] p-2 text-white hover:bg-[#e04300] transition-colors"
                    >
                      {zapierCopiedUrl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* API Key */}
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Clé API (Bearer Token)</label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type={zapierShowKey ? 'text' : 'password'}
                        value={zapierApiKey}
                        readOnly
                        className="w-full rounded-lg border border-orange-200 bg-white py-2 px-3 pr-9 text-xs text-slate-700 font-mono"
                      />
                      <button
                        onClick={() => setZapierShowKey(!zapierShowKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {zapierShowKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(zapierApiKey!);
                        setZapierCopiedKey(true);
                        setTimeout(() => setZapierCopiedKey(false), 2000);
                      }}
                      className="rounded-lg bg-[#FF4A00] p-2 text-white hover:bg-[#e04300] transition-colors"
                    >
                      {zapierCopiedKey ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Instructions */}
                <div className="rounded-lg border border-orange-200 bg-white p-3">
                  <h5 className="mb-2 text-xs font-bold text-slate-800">Configuration dans Zapier :</h5>
                  <ol className="text-[11px] text-slate-600 space-y-1.5 list-decimal list-inside">
                    <li>Créez un nouveau Zap avec votre source (Facebook Ads, Typeform...)</li>
                    <li>Action : <strong>Webhooks by Zapier</strong> → <strong>POST</strong></li>
                    <li>URL : collez l'URL ci-dessus</li>
                    <li>Headers : <code className="bg-slate-100 px-1 rounded text-[10px]">Authorization: Bearer votre_clé</code></li>
                    <li>Body (JSON) : mappez vos champs → <code className="bg-slate-100 px-1 rounded text-[10px]">firstName, lastName, email, phone, company, source</code></li>
                  </ol>
                </div>

                <p className="text-[10px] text-orange-600/70">
                  Les prospects importés via Zapier sont visibles par le propriétaire et tous les membres de l'équipe.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ─── Pipedrive Config ─── */}
        {selected === 'pipedrive' && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 mb-4">
            <h4 className="text-sm font-semibold text-green-900 mb-3 flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              Configuration Pipedrive
            </h4>

            {!pipedriveConnected ? (
              <div>
                <p className="text-xs text-green-700/80 leading-relaxed mb-3">
                  Connectez votre compte Pipedrive pour synchroniser vos deals.
                </p>
                <button
                  onClick={handleConnectPipedrive}
                  className="w-full flex justify-center items-center gap-2 rounded-xl bg-green-600 py-3 text-sm font-bold text-white hover:bg-green-500 transition-all"
                >
                  <LinkIcon className="h-4 w-4" />
                  Connecter Pipedrive
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Connected status */}
                <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-700">Pipedrive Connecté</span>
                  </div>
                  <button onClick={handleDisconnectPipedrive} className="text-xs text-slate-500 hover:text-red-500 underline">Déconnecter</button>
                </div>

                {/* Sync button */}
                <button
                  onClick={handleSyncPipedrive}
                  disabled={isSyncingPipedrive}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-green-300 bg-green-100 py-2.5 text-sm font-semibold text-green-800 hover:bg-green-200 transition-all disabled:opacity-50"
                >
                  {isSyncingPipedrive ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Synchronisation en cours...</>
                  ) : (
                    <><RefreshCw className="h-4 w-4" /> Synchroniser Pipedrive</>
                  )}
                </button>

                {/* Sync result */}
                {syncResult && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700 font-medium">
                    {syncResult.imported} deals importés, {syncResult.updated} mis à jour
                  </div>
                )}

                {/* Stage mapping */}
                <div className="rounded-lg border border-green-200 bg-white p-4">
                  <h5 className="mb-3 text-xs font-bold uppercase tracking-wider text-green-800">Mapping des étapes</h5>
                  {loadingPipelines ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" /> Chargement...
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {CLOSEOS_STAGES.map(stage => (
                        <div key={stage.id}>
                          <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">{stage.name}</label>
                          <div className="relative">
                            <select
                              value={pipedriveMappings[stage.id] || ''}
                              onChange={(e) => handleUpdatePipedriveMapping(stage.id, Number(e.target.value))}
                              className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 pr-8 text-sm text-slate-900 focus:border-green-500 focus:outline-none"
                            >
                              <option value="">Sélectionner une étape Pipedrive</option>
                              {pipedrivePipelines.map(pipe => (
                                <optgroup key={pipe.id} label={pipe.name}>
                                  {pipedriveStages.filter((s: any) => s.pipeline_id === pipe.id).map((s: any) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Save button */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 py-3 font-medium text-slate-600 hover:bg-slate-50 transition-all"
          >
            Fermer
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-xl bg-amber-600 py-3 font-bold text-white hover:bg-amber-500 transition-all disabled:opacity-50"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
