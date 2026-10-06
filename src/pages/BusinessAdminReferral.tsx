import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, Copy, Check, Eye, Users, DollarSign, TrendingUp, X, Loader2, ExternalLink, Trash2, ChevronDown } from 'lucide-react';

const API_BASE = '/api/business-referral';
const PLANS = ['solo', 'business', 'business_acquisition'] as const;
const PLAN_LABELS: Record<string, string> = { solo: 'Solo', business: 'Business', business_acquisition: 'Business + Acquisition' };
const BILLING_CYCLES = ['monthly', 'quarterly', 'annual'] as const;
const BILLING_LABELS: Record<string, string> = { monthly: 'Mensuel', quarterly: 'Trimestriel', annual: 'Annuel' };
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'Actif', color: 'bg-emerald-50 text-emerald-700' },
  churned: { label: 'Churne', color: 'bg-red-50 text-red-700' },
  trial: { label: 'Trial', color: 'bg-amber-50 text-amber-700' },
};

function apiFetch(action: string, password: string, opts?: { method?: string; body?: any; params?: Record<string, string> }) {
  const params = new URLSearchParams({ action, ...(opts?.params || {}) });
  return fetch(`${API_BASE}?${params}`, {
    method: opts?.method || 'GET',
    headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
    ...(opts?.body ? { body: JSON.stringify(opts.body) } : {}),
  }).then(r => r.json()).catch(() => ({}));
}

export default function BusinessAdminReferral() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('ref_admin_auth') === '1');
  const [authError, setAuthError] = useState(false);
  const [storedPw, setStoredPw] = useState(() => sessionStorage.getItem('ref_admin_pw') || '');

  const handleAuth = () => {
    if (password === '290917') {
      setAuthed(true);
      setStoredPw(password);
      sessionStorage.setItem('ref_admin_auth', '1');
      sessionStorage.setItem('ref_admin_pw', password);
      setAuthError(false);
    } else {
      setAuthError(true);
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen min-h-dvh bg-[#f4f2f1] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6 sm:p-8">
          <h1 className="text-xl font-extrabold text-stone-900 tracking-tight mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Admin Referral
          </h1>
          <p className="text-sm text-stone-500 mb-6">Entrez le mot de passe pour acceder.</p>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setAuthError(false); }}
            onKeyDown={e => e.key === 'Enter' && handleAuth()}
            placeholder="Mot de passe"
            className="w-full rounded-xl border border-stone-200 bg-stone-50 py-3 px-4 text-sm text-stone-900 outline-none focus:ring-2 focus:ring-stone-900/10 mb-3"
            autoFocus
          />
          {authError && <p className="text-xs text-red-500 mb-3">Mot de passe incorrect</p>}
          <button onClick={handleAuth} className="w-full rounded-full bg-stone-900 py-3 text-sm font-bold text-white hover:bg-stone-800 transition-colors">
            Acceder
          </button>
        </div>
      </div>
    );
  }

  return <ReferralDashboard password={storedPw} />;
}

// ─── Dashboard ───

function ReferralDashboard({ password }: { password: string }) {
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedLink, setSelectedLink] = useState<string | null>(null);

  const loadLinks = useCallback(async () => {
    setLoading(true);
    const data = await apiFetch('list', password);
    setLinks(data.links || []);
    setLoading(false);
  }, [password]);

  useEffect(() => { loadLinks(); }, [loadLinks]);

  if (selectedLink) {
    return <LinkDetail linkId={selectedLink} password={password} onBack={() => { setSelectedLink(null); loadLinks(); }} />;
  }

  return (
    <div className="min-h-screen min-h-dvh bg-[#f4f2f1]">
      <div className="max-w-5xl mx-auto px-4 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-10">
        <div className="flex items-center justify-between gap-3 mb-5 sm:mb-8">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-extrabold text-stone-900 tracking-tight truncate sm:overflow-visible" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Liens de parrainage
            </h1>
            <p className="text-xs sm:text-sm text-stone-500 mt-0.5 sm:mt-1">Gerez vos partenaires et suivez les commissions</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            aria-label="Creer un lien"
            className="flex h-10 w-10 sm:h-auto sm:w-auto shrink-0 items-center justify-center gap-2 rounded-full bg-stone-900 sm:px-5 sm:py-2.5 text-sm font-bold text-white hover:bg-stone-800 active:scale-95 sm:active:scale-100 transition-all sm:transition-colors"
          >
            <Plus className="h-5 w-5 sm:h-4 sm:w-4" /><span className="hidden sm:inline"> Creer un lien</span>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
          </div>
        ) : links.length === 0 ? (
          <div className="text-center py-8 sm:py-20 text-stone-400">
            <Users className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 sm:mb-3 opacity-40" />
            <p className="text-sm">Aucun lien de parrainage</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {links.map(link => (
              <LinkCard key={link.id} link={link} onClick={() => setSelectedLink(link.id)} />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateLinkModal
          password={password}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadLinks(); }}
        />
      )}
    </div>
  );
}

// ─── Link Card ───

function LinkCard({ link, onClick }: { link: any; onClick: () => void }) {
  const [copied, setCopied] = useState(false);
  const fullUrl = `${window.location.origin}/business?ref=${link.slug}`;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl p-4 sm:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all active:scale-[0.98] sm:active:scale-100 cursor-pointer border border-stone-100"
    >
      <div className="flex items-start justify-between gap-2 mb-3 sm:mb-4">
        <div className="min-w-0">
          <h3 className="font-extrabold text-stone-900 tracking-tight truncate sm:overflow-visible sm:whitespace-normal" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {link.partner_name}
          </h3>
          <div className="flex items-center gap-1.5 mt-1">
            <p className="text-xs text-stone-400 font-mono truncate max-w-[180px]">/business?ref={link.slug}</p>
            <button onClick={handleCopy} aria-label="Copier" className="shrink-0 -m-2 p-2 sm:m-0 sm:p-0 text-stone-400 hover:text-stone-600 transition-colors">
              {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
        </div>
        {!link.is_active && (
          <span className="shrink-0 whitespace-nowrap text-[10px] font-bold uppercase bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">Inactif</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-stone-100 pt-3 sm:gap-3 sm:border-t-0 sm:pt-0">
        <Stat icon={Eye} label="Vues" value={link.views || 0} />
        <Stat icon={Users} label="Actifs" value={`${link.stats.active_conversions}/${link.stats.total_conversions}`} />
        <Stat icon={DollarSign} label="CA total" value={`${(link.stats.total_paid || 0).toFixed(0)}€`} />
        <Stat icon={TrendingUp} label="Comm. MRR" value={`${(link.stats.commission_mrr || 0).toFixed(0)}€`} color="text-emerald-600" />
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color?: string }) {
  return (
    <div className="min-w-0 sm:rounded-xl sm:bg-stone-50 sm:p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3 w-3 shrink-0 text-stone-400" />
        <span className="truncate sm:overflow-visible text-[10px] font-semibold uppercase tracking-wider text-stone-400">{label}</span>
      </div>
      <p className={`text-sm font-bold ${color || 'text-stone-900'}`} style={{ fontFamily: 'Manrope, sans-serif' }}>{value}</p>
    </div>
  );
}

// ─── Create Modal ───

function CreateLinkModal({ password, onClose, onCreated }: { password: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [config, setConfig] = useState<Record<string, { fixed: number; percent: number; per_billing?: Record<string, { fixed: number; percent: number }> }>>({
    solo: { fixed: 0, percent: 0 },
    business: { fixed: 0, percent: 0 },
    business_acquisition: { fixed: 0, percent: 0 },
  });
  const [advancedOpen, setAdvancedOpen] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name || !slug) { setError('Nom et slug requis'); return; }
    setSaving(true);
    const data = await apiFetch('create', password, { method: 'POST', body: { partner_name: name, slug, commission_config: config } });
    if (data.error) { setError(data.error); setSaving(false); return; }
    onCreated();
  };

  const updateConfig = (plan: string, field: 'fixed' | 'percent', value: number) => {
    setConfig(prev => ({ ...prev, [plan]: { ...prev[plan], [field]: value } }));
  };

  const toggleAdvanced = (plan: string) => {
    setAdvancedOpen(prev => ({ ...prev, [plan]: !prev[plan] }));
    // Initialize per_billing when opening for the first time
    setConfig(prev => {
      const current = prev[plan];
      if (!current.per_billing) {
        return {
          ...prev,
          [plan]: {
            ...current,
            per_billing: {
              monthly: { fixed: current.fixed, percent: current.percent },
              quarterly: { fixed: current.fixed, percent: current.percent },
              annual: { fixed: current.fixed, percent: current.percent },
            }
          }
        };
      }
      return prev;
    });
  };

  const updateBillingConfig = (plan: string, cycle: string, field: 'fixed' | 'percent', value: number) => {
    setConfig(prev => ({
      ...prev,
      [plan]: {
        ...prev[plan],
        per_billing: {
          ...prev[plan].per_billing,
          [cycle]: { ...prev[plan].per_billing![cycle], [field]: value }
        }
      }
    }));
  };

  const removeAdvanced = (plan: string) => {
    setAdvancedOpen(prev => ({ ...prev, [plan]: false }));
    setConfig(prev => {
      const { per_billing, ...rest } = prev[plan];
      return { ...prev, [plan]: rest };
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl px-5 pt-0 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6 max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain" onClick={e => e.stopPropagation()}>
        {/* Poignée de la feuille (mobile) */}
        <div className="sm:hidden mx-auto mt-2 h-1 w-10 rounded-full bg-stone-300" />
        {/* En-tête collant sur mobile : le bouton fermer reste visible */}
        <div className="sticky top-0 z-10 -mx-5 px-5 py-2 bg-white sm:static sm:mx-0 sm:px-0 sm:py-0 flex items-center justify-between mb-3 sm:mb-5">
          <h2 className="text-lg font-extrabold text-stone-900 tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Nouveau lien
          </h2>
          <button onClick={onClose} aria-label="Fermer" className="-mr-2 sm:mr-0 p-2.5 sm:p-2 text-stone-400 hover:text-stone-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1.5">Nom du partenaire</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Thomas, Enzo..."
              className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2.5 px-4 text-sm text-stone-900 placeholder:text-stone-400 outline-none focus:ring-2 focus:ring-stone-900/10" />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1.5">Slug (dans l'URL)</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-stone-400 shrink-0">/business?ref=</span>
              <input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="thomas" className="flex-1 min-w-0 rounded-xl border border-stone-200 bg-stone-50 py-2.5 px-4 text-sm text-stone-900 placeholder:text-stone-400 outline-none focus:ring-2 focus:ring-stone-900/10 font-mono" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3">Commission par formule</label>
            <div className="space-y-3">
              {PLANS.map(plan => (
                <div key={plan} className="rounded-xl bg-stone-50 p-3">
                  {/* Default row */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-2 sm:gap-3">
                    <span className="flex-1 sm:flex-initial min-w-0 sm:min-w-[140px] text-sm font-semibold text-stone-700">{PLAN_LABELS[plan]}</span>
                    {!advancedOpen[plan] && (
                      <div className="order-last sm:order-none w-full sm:w-auto flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <input type="number" min={0} step={1} value={config[plan]?.fixed || 0}
                            onChange={e => updateConfig(plan, 'fixed', Number(e.target.value))}
                            className="w-14 sm:w-16 rounded-lg border border-stone-200 bg-white py-1.5 px-2 text-sm text-stone-900 text-center outline-none" />
                          <span className="text-xs text-stone-400">€</span>
                        </div>
                        <span className="text-stone-300">+</span>
                        <div className="flex items-center gap-1.5">
                          <input type="number" min={0} max={100} step={1} value={config[plan]?.percent || 0}
                            onChange={e => updateConfig(plan, 'percent', Number(e.target.value))}
                            className="w-14 sm:w-16 rounded-lg border border-stone-200 bg-white py-1.5 px-2 text-sm text-stone-900 text-center outline-none" />
                          <span className="text-xs text-stone-400">%</span>
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => advancedOpen[plan] ? removeAdvanced(plan) : toggleAdvanced(plan)}
                      className="ml-auto -my-2 py-2 sm:my-0 sm:py-0 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400 hover:text-stone-600 transition-colors"
                    >
                      Avance
                      <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${advancedOpen[plan] ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {/* Per-billing breakdown */}
                  {advancedOpen[plan] && config[plan]?.per_billing && (
                    <div className="mt-3 space-y-2 pl-2 border-l-2 border-stone-200 ml-1">
                      {BILLING_CYCLES.map(cycle => (
                        <div key={cycle} className="flex items-center gap-2 sm:gap-3">
                          <span className="text-xs font-medium text-stone-500 min-w-[72px] sm:min-w-[80px]">{BILLING_LABELS[cycle]}</span>
                          <div className="flex items-center gap-1.5">
                            <input type="number" min={0} step={1} value={config[plan]?.per_billing?.[cycle]?.fixed || 0}
                              onChange={e => updateBillingConfig(plan, cycle, 'fixed', Number(e.target.value))}
                              className="w-14 sm:w-16 rounded-lg border border-stone-200 bg-white py-1.5 px-2 text-sm text-stone-900 text-center outline-none" />
                            <span className="text-xs text-stone-400">€</span>
                          </div>
                          <span className="text-stone-300">+</span>
                          <div className="flex items-center gap-1.5">
                            <input type="number" min={0} max={100} step={1} value={config[plan]?.per_billing?.[cycle]?.percent || 0}
                              onChange={e => updateBillingConfig(plan, cycle, 'percent', Number(e.target.value))}
                              className="w-14 sm:w-16 rounded-lg border border-stone-200 bg-white py-1.5 px-2 text-sm text-stone-900 text-center outline-none" />
                            <span className="text-xs text-stone-400">%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button onClick={handleCreate} disabled={saving}
            className="w-full rounded-full bg-stone-900 py-3.5 sm:py-3 text-sm font-bold text-white hover:bg-stone-800 active:scale-[0.98] sm:active:scale-100 transition-all sm:transition-colors disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Creer le lien'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Link Detail ───

function LinkDetail({ linkId, password, onBack }: { linkId: string; password: string; onBack: () => void }) {
  const [link, setLink] = useState<any>(null);
  const [conversions, setConversions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [planFilter, setPlanFilter] = useState('all');
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    const data = await apiFetch('detail', password, { params: { link_id: linkId, plan_filter: planFilter } });
    setLink(data.link);
    setConversions(data.conversions || []);
    setLoading(false);
  }, [linkId, password, planFilter]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const handleCopy = () => {
    if (!link) return;
    navigator.clipboard.writeText(`${window.location.origin}/business?ref=${link.slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    if (!confirm('Supprimer ce lien et toutes ses conversions ?')) return;
    setDeleting(true);
    await apiFetch('delete', password, { method: 'POST', body: { link_id: linkId } });
    onBack();
  };

  if (loading) {
    return (
      <div className="min-h-screen min-h-dvh bg-[#f4f2f1] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
      </div>
    );
  }

  if (!link) return null;

  const activeCount = conversions.filter(c => c.status === 'active').length;
  const totalPaid = conversions.reduce((s, c) => s + Number(c.total_paid || 0), 0);
  const totalCommission = conversions.reduce((s, c) => s + Number(c.total_commission || 0), 0);
  const mrrCommission = conversions.filter(c => c.status === 'active').reduce((s, c) => s + Number(c.monthly_commission || 0), 0);

  return (
    <div className="min-h-screen min-h-dvh bg-[#f4f2f1]">
      <div className="max-w-5xl mx-auto px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-10">
        {/* Header */}
        <button onClick={onBack} className="flex items-center gap-2 min-h-[40px] sm:min-h-0 text-sm text-stone-500 hover:text-stone-700 mb-2 sm:mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Retour
        </button>

        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-stone-100 mb-4 sm:mb-6">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 sm:flex-initial">
              <h1 className="text-lg sm:text-xl font-extrabold truncate sm:overflow-visible sm:whitespace-normal text-stone-900 tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {link.partner_name}
              </h1>
              <div className="flex items-center gap-2 mt-2">
                <code className="min-w-0 truncate sm:overflow-visible sm:whitespace-normal text-xs bg-stone-100 text-stone-600 px-3 py-1.5 rounded-lg">
                  {window.location.origin}/business?ref={link.slug}
                </code>
                <button onClick={handleCopy} aria-label="Copier" className="shrink-0 p-2 -m-2 sm:m-0 sm:p-0 text-stone-400 hover:text-stone-600 transition-colors">
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button onClick={handleDelete} disabled={deleting}
              aria-label="Supprimer" className="shrink-0 -mr-1 sm:mr-0 p-2.5 sm:p-2 text-stone-400 hover:text-red-500 transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-3 sm:gap-4 mt-4 pt-4 border-t border-stone-100 sm:mt-6 sm:pt-0 sm:border-t-0">
            <StatBlock label="Vues" value={link.views || 0} />
            <StatBlock label="Abonnes actifs" value={`${activeCount}/${conversions.length}`} />
            <StatBlock label="CA total" value={`${totalPaid.toFixed(0)}€`} />
            <StatBlock label="Comm. totale due" value={`${totalCommission.toFixed(0)}€`} color="text-emerald-600" />
          </div>

          {/* Commission config display */}
          <div className="mt-4 pt-4 sm:mt-5 sm:pt-5 border-t border-stone-100">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 mb-2">Commission configuree</p>
            <div className="space-y-2">
              {PLANS.map(plan => {
                const cfg = (link.commission_config as any)?.[plan] || {};
                const hasBilling = cfg.per_billing && Object.keys(cfg.per_billing).length > 0;
                return (
                  <div key={plan}>
                    <span className="text-xs bg-stone-50 text-stone-600 px-3 py-1.5 rounded-lg inline-block">
                      {PLAN_LABELS[plan]}: {hasBilling ? 'par cycle' : `${cfg.fixed || 0}€ + ${cfg.percent || 0}%`}
                    </span>
                    {hasBilling && (
                      <div className="mt-1 ml-3 flex flex-wrap gap-1.5">
                        {BILLING_CYCLES.map(cycle => {
                          const bc = cfg.per_billing[cycle] || {};
                          return (
                            <span key={cycle} className="text-[11px] bg-stone-100 text-stone-500 px-2 py-1 rounded-md">
                              {BILLING_LABELS[cycle]}: {bc.fixed || 0}€ + {bc.percent || 0}%
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2 mb-3 sm:mb-4 overflow-x-auto overscroll-x-contain no-scrollbar snap-x scroll-px-4 sm:scroll-px-0 -mx-4 px-4 sm:mx-0 sm:px-0">
          {['all', ...PLANS].map(p => (
            <button
              key={p}
              onClick={() => setPlanFilter(p)}
              className={`shrink-0 snap-start whitespace-nowrap rounded-full px-4 py-2 sm:py-1.5 text-xs font-semibold transition-colors ${
                planFilter === p ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
              }`}
            >
              {p === 'all' ? 'Tous' : PLAN_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Conversions table */}
        {conversions.length === 0 ? (
          <div className="text-center py-8 sm:py-16 text-stone-400">
            <p className="text-sm">Aucune conversion</p>
          </div>
        ) : (
          <>
          {/* Mobile + iPad portrait : liste compacte (une ligne par conversion) */}
          <div className="lg:hidden bg-white rounded-2xl shadow-sm border border-stone-100 divide-y divide-stone-100">
            {conversions.map(conv => {
              const st = STATUS_LABELS[conv.status] || STATUS_LABELS.trial;
              return (
                <div key={conv.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-stone-900">{conv.user_name || '—'}</p>
                    <p className="truncate text-xs text-stone-400">{conv.user_email || '—'}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="whitespace-nowrap text-[11px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full font-medium">
                        {PLAN_LABELS[conv.subscription_plan] || conv.subscription_plan || '—'}
                      </span>
                      <span className={`whitespace-nowrap text-[11px] px-2 py-0.5 rounded-full font-semibold ${st.color}`}>{st.label}</span>
                      <span className="whitespace-nowrap text-[11px] text-stone-400">
                        {BILLING_LABELS[conv.billing_cycle] || conv.billing_cycle || '—'} · {conv.created_at ? new Date(conv.created_at).toLocaleDateString('fr-FR') : '—'}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="whitespace-nowrap text-sm font-semibold text-stone-900">
                      <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400">CA</span>{Number(conv.total_paid || 0).toFixed(0)}€
                    </p>
                    <p className="whitespace-nowrap text-sm font-semibold text-emerald-600">
                      <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400">Comm.</span>{Number(conv.total_commission || 0).toFixed(0)}€
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="hidden lg:block bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 text-left">
                    <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-stone-400">Utilisateur</th>
                    <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-stone-400">Formule</th>
                    <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-stone-400">Cycle</th>
                    <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-stone-400">Statut</th>
                    <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-stone-400">Inscription</th>
                    <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-stone-400 text-right">CA</th>
                    <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-stone-400 text-right">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {conversions.map(conv => {
                    const st = STATUS_LABELS[conv.status] || STATUS_LABELS.trial;
                    return (
                      <tr key={conv.id} className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-stone-900">{conv.user_name || '—'}</p>
                          <p className="text-xs text-stone-400">{conv.user_email || '—'}</p>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-xs bg-stone-100 text-stone-600 px-2.5 py-1 rounded-full font-medium">
                            {PLAN_LABELS[conv.subscription_plan] || conv.subscription_plan || '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-xs text-stone-500 font-medium">
                            {BILLING_LABELS[conv.billing_cycle] || conv.billing_cycle || '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${st.color}`}>{st.label}</span>
                        </td>
                        <td className="px-5 py-3 text-stone-500 text-xs">
                          {conv.created_at ? new Date(conv.created_at).toLocaleDateString('fr-FR') : '—'}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-stone-900">
                          {Number(conv.total_paid || 0).toFixed(0)}€
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-emerald-600">
                          {Number(conv.total_commission || 0).toFixed(0)}€
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatBlock({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="min-w-0 sm:rounded-xl sm:bg-stone-50 sm:p-4">
      <p className="truncate sm:overflow-visible text-[10px] font-semibold uppercase tracking-wider text-stone-400 mb-1">{label}</p>
      <p className={`text-base sm:text-lg font-extrabold ${color || 'text-stone-900'}`} style={{ fontFamily: 'Manrope, sans-serif' }}>{value}</p>
    </div>
  );
}
