import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, Copy, Check, Eye, Users, DollarSign, TrendingUp, X, Loader2, ExternalLink, Trash2 } from 'lucide-react';

const API_BASE = '/api/business-referral';
const PLANS = ['solo', 'business', 'business_acquisition'] as const;
const PLAN_LABELS: Record<string, string> = { solo: 'Solo', business: 'Business', business_acquisition: 'Business + Acquisition' };
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
      <div className="min-h-screen bg-[#f4f2f1] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
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
    <div className="min-h-screen bg-[#f4f2f1]">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-stone-900 tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Liens de parrainage
            </h1>
            <p className="text-sm text-stone-500 mt-1">Gerez vos partenaires et suivez les commissions</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-stone-800 transition-colors"
          >
            <Plus className="h-4 w-4" /> Creer un lien
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
          </div>
        ) : links.length === 0 ? (
          <div className="text-center py-20 text-stone-400">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Aucun lien de parrainage</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all cursor-pointer border border-stone-100"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-extrabold text-stone-900 tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {link.partner_name}
          </h3>
          <div className="flex items-center gap-1.5 mt-1">
            <p className="text-xs text-stone-400 font-mono truncate max-w-[180px]">/business?ref={link.slug}</p>
            <button onClick={handleCopy} className="text-stone-400 hover:text-stone-600 transition-colors">
              {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
        </div>
        {!link.is_active && (
          <span className="text-[10px] font-bold uppercase bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">Inactif</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
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
    <div className="rounded-xl bg-stone-50 p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3 w-3 text-stone-400" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">{label}</span>
      </div>
      <p className={`text-sm font-bold ${color || 'text-stone-900'}`} style={{ fontFamily: 'Manrope, sans-serif' }}>{value}</p>
    </div>
  );
}

// ─── Create Modal ───

function CreateLinkModal({ password, onClose, onCreated }: { password: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [config, setConfig] = useState<Record<string, { fixed: number; percent: number }>>({
    solo: { fixed: 0, percent: 0 },
    business: { fixed: 0, percent: 0 },
    business_acquisition: { fixed: 0, percent: 0 },
  });
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-extrabold text-stone-900 tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Nouveau lien
          </h2>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1.5">Nom du partenaire</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Thomas, Enzo..."
              className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2.5 px-4 text-sm outline-none focus:ring-2 focus:ring-stone-900/10" />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1.5">Slug (dans l'URL)</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-stone-400 shrink-0">/business?ref=</span>
              <input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="thomas" className="flex-1 rounded-xl border border-stone-200 bg-stone-50 py-2.5 px-4 text-sm outline-none focus:ring-2 focus:ring-stone-900/10 font-mono" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3">Commission par formule</label>
            <div className="space-y-3">
              {PLANS.map(plan => (
                <div key={plan} className="flex items-center gap-3 rounded-xl bg-stone-50 p-3">
                  <span className="text-sm font-semibold text-stone-700 min-w-[140px]">{PLAN_LABELS[plan]}</span>
                  <div className="flex items-center gap-1.5">
                    <input type="number" min={0} step={1} value={config[plan]?.fixed || 0}
                      onChange={e => updateConfig(plan, 'fixed', Number(e.target.value))}
                      className="w-16 rounded-lg border border-stone-200 bg-white py-1.5 px-2 text-sm text-center outline-none" />
                    <span className="text-xs text-stone-400">€</span>
                  </div>
                  <span className="text-stone-300">+</span>
                  <div className="flex items-center gap-1.5">
                    <input type="number" min={0} max={100} step={1} value={config[plan]?.percent || 0}
                      onChange={e => updateConfig(plan, 'percent', Number(e.target.value))}
                      className="w-16 rounded-lg border border-stone-200 bg-white py-1.5 px-2 text-sm text-center outline-none" />
                    <span className="text-xs text-stone-400">%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button onClick={handleCreate} disabled={saving}
            className="w-full rounded-full bg-stone-900 py-3 text-sm font-bold text-white hover:bg-stone-800 transition-colors disabled:opacity-50">
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
      <div className="min-h-screen bg-[#f4f2f1] flex items-center justify-center">
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
    <div className="min-h-screen bg-[#f4f2f1]">
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700 mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Retour
        </button>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-extrabold text-stone-900 tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {link.partner_name}
              </h1>
              <div className="flex items-center gap-2 mt-2">
                <code className="text-xs bg-stone-100 text-stone-600 px-3 py-1.5 rounded-lg">
                  {window.location.origin}/business?ref={link.slug}
                </code>
                <button onClick={handleCopy} className="text-stone-400 hover:text-stone-600 transition-colors">
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button onClick={handleDelete} disabled={deleting}
              className="p-2 text-stone-400 hover:text-red-500 transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            <StatBlock label="Vues" value={link.views || 0} />
            <StatBlock label="Abonnes actifs" value={`${activeCount}/${conversions.length}`} />
            <StatBlock label="CA total" value={`${totalPaid.toFixed(0)}€`} />
            <StatBlock label="Comm. totale due" value={`${totalCommission.toFixed(0)}€`} color="text-emerald-600" />
          </div>

          {/* Commission config display */}
          <div className="mt-5 pt-5 border-t border-stone-100">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 mb-2">Commission configuree</p>
            <div className="flex flex-wrap gap-2">
              {PLANS.map(plan => {
                const cfg = (link.commission_config as any)?.[plan] || {};
                return (
                  <span key={plan} className="text-xs bg-stone-50 text-stone-600 px-3 py-1.5 rounded-lg">
                    {PLAN_LABELS[plan]}: {cfg.fixed || 0}€ + {cfg.percent || 0}%
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2 mb-4">
          {['all', ...PLANS].map(p => (
            <button
              key={p}
              onClick={() => setPlanFilter(p)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                planFilter === p ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
              }`}
            >
              {p === 'all' ? 'Tous' : PLAN_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Conversions table */}
        {conversions.length === 0 ? (
          <div className="text-center py-16 text-stone-400">
            <p className="text-sm">Aucune conversion</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 text-left">
                    <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-stone-400">Utilisateur</th>
                    <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-stone-400">Formule</th>
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
        )}
      </div>
    </div>
  );
}

function StatBlock({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-xl bg-stone-50 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 mb-1">{label}</p>
      <p className={`text-lg font-extrabold ${color || 'text-stone-900'}`} style={{ fontFamily: 'Manrope, sans-serif' }}>{value}</p>
    </div>
  );
}
