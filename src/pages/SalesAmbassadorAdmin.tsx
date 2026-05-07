import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Copy, Check, Trash2, Loader2, ExternalLink, X, Users, MousePointerClick,
  CreditCard, UserMinus, Wallet, Banknote, Pencil, Lock, Unlock, Calendar, AlertCircle, ArrowRight,
} from 'lucide-react';

const API = '/api/sales-ambassador';

type Stats = {
  clicks: number; signups: number; paid: number; canceled: number;
  commissionsPaidCents: number; commissionsPendingCents: number; commissionsFailedCents: number;
};

type Ambassador = {
  id: string;
  name: string;
  email: string | null;
  slug: string;
  dashboard_token: string;
  notes: string | null;
  admin_notes: string | null;
  created_at: string;
  pool_pct_monthly: number;
  pool_pct_qy: number;
  payout_threshold_cents: number;
  split: {
    toFilleulPct: number;
    hasSet: boolean;
    locked: boolean;
    monthly: { pool: number; commissionPct: number; discountPct: number; code: string | null };
    qy: { pool: number; commissionPct: number; discountPct: number; code: string | null };
  };
  connect: { connected: boolean; status: string };
  payout: { dayOfMonth: number; method: 'stripe' | 'offline'; thresholdCents: number };
  stats: Stats;
};

function api(action: string, password: string, opts?: { method?: string; body?: any; params?: Record<string, string> }) {
  const params = new URLSearchParams({ action, ...(opts?.params || {}) });
  return fetch(`${API}?${params}`, {
    method: opts?.method || 'GET',
    headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
    ...(opts?.body ? { body: JSON.stringify(opts.body) } : {}),
  }).then(async r => {
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  });
}

export default function SalesAmbassadorAdmin() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('amb_admin_auth') === '1');
  const [storedPw, setStoredPw] = useState(() => sessionStorage.getItem('amb_admin_pw') || '');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState(false);

  const handleAuth = async () => {
    setAuthChecking(true);
    setAuthError(null);
    const { ok, status, data } = await api('list', password);
    setAuthChecking(false);
    if (ok) {
      setAuthed(true);
      setStoredPw(password);
      sessionStorage.setItem('amb_admin_auth', '1');
      sessionStorage.setItem('amb_admin_pw', password);
    } else if (status === 503) {
      setAuthError(data?.error || 'Configuration serveur manquante (ADMIN_AMB_PASSWORD)');
    } else {
      setAuthError('Mot de passe incorrect');
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-[#0B1121] p-8 shadow-2xl">
          <h1 className="text-xl font-extrabold text-white mb-1">Admin Ambassadeurs</h1>
          <p className="text-sm text-slate-400 mb-6">CloseOS Sales</p>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setAuthError(null); }}
            onKeyDown={e => e.key === 'Enter' && handleAuth()}
            placeholder="Mot de passe"
            className="w-full rounded-xl border border-slate-700 bg-slate-900/60 py-3 px-4 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/40 mb-3"
            autoFocus
          />
          {authError && <p className="text-xs text-red-400 mb-3">{authError}</p>}
          <button
            onClick={handleAuth}
            disabled={authChecking || !password}
            className="w-full rounded-full bg-white py-3 text-sm font-bold text-slate-900 hover:bg-slate-200 transition disabled:opacity-50"
          >
            {authChecking ? 'Vérification…' : 'Accéder'}
          </button>
        </div>
      </div>
    );
  }

  return <Dashboard password={storedPw} />;
}

function Dashboard({ password }: { password: string }) {
  const [list, setList] = useState<Ambassador[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Ambassador | null>(null);
  const [payingOut, setPayingOut] = useState<Ambassador | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api('list', password);
    setList(data?.ambassadors || []);
    setLoading(false);
  }, [password]);

  useEffect(() => { load(); }, [load]);

  const remove = async (id: string, name: string) => {
    if (!confirm(`Supprimer l'ambassadeur "${name}" et tous ses tracking ?`)) return;
    await api('delete', password, { method: 'DELETE', params: { id } });
    load();
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.closeos.fr';

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/15 opacity-30 blur-[120px] rounded-full pointer-events-none" />
      <div className="relative max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Programme Ambassadeurs</h1>
            <p className="text-slate-400 text-sm mt-1">CloseOS Sales — gestion & tracking</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-900 hover:bg-slate-200 transition"
          >
            <Plus className="w-4 h-4" />
            Nouvel ambassadeur
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-[#0B1121] p-12 text-center">
            <Users className="w-10 h-10 mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400 mb-4">Aucun ambassadeur pour le moment.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-900 hover:bg-slate-200 transition"
            >
              <Plus className="w-4 h-4" />
              Créer le premier
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map(a => (
              <AmbassadorCard
                key={a.id}
                amb={a}
                origin={origin}
                onDelete={() => remove(a.id, a.name)}
                onEdit={() => setEditing(a)}
                onPayout={() => setPayingOut(a)}
              />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <AmbassadorFormModal
          mode="create"
          password={password}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load(); }}
        />
      )}
      {editing && (
        <AmbassadorFormModal
          mode="edit"
          password={password}
          ambassador={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
      {payingOut && (
        <PayoutModal
          ambassador={payingOut}
          password={password}
          onClose={() => setPayingOut(null)}
          onPaid={() => { setPayingOut(null); load(); }}
        />
      )}
    </div>
  );
}

// ─── AmbassadorCard ───────────────────────────────────────────────────────────

function AmbassadorCard({ amb, origin, onDelete, onEdit, onPayout }: {
  amb: Ambassador; origin: string; onDelete: () => void; onEdit: () => void; onPayout: () => void;
}) {
  const refLink = `${origin}/?amb=${amb.slug}`;
  const dashLink = `${origin}/sales/amb/d/${amb.dashboard_token}`;
  const pendingEur = amb.stats.commissionsPendingCents / 100;

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0B1121] p-5">
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-bold">{amb.name}</h3>
            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 text-xs font-mono">{amb.slug}</span>
            <ConnectChip status={amb.connect.status} connected={amb.connect.connected} />
            {amb.split.locked ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 text-[10px] font-bold uppercase tracking-wide">
                <Lock className="w-3 h-3" /> {amb.split.toFilleulPct}% au filleul
              </span>
            ) : amb.split.hasSet ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 text-[10px] font-bold uppercase tracking-wide">
                <Unlock className="w-3 h-3" /> {amb.split.toFilleulPct}% au filleul
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 text-[10px] font-bold uppercase tracking-wide">
                Split non choisi
              </span>
            )}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-700/40 text-slate-300 text-[10px] font-bold uppercase tracking-wide">
              <Calendar className="w-3 h-3" /> Versement le {amb.payout.dayOfMonth}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-700/40 text-slate-300 text-[10px] font-bold uppercase tracking-wide">
              {amb.payout.method === 'stripe' ? 'Stripe' : 'Offline'}
            </span>
          </div>
          {amb.email && <p className="text-sm text-slate-400 mt-0.5">{amb.email}</p>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onEdit} className="text-slate-400 hover:text-white transition p-2 rounded-lg hover:bg-slate-800/40" title="Modifier">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="text-slate-500 hover:text-red-400 transition p-2 rounded-lg hover:bg-red-500/10" title="Supprimer">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Engagement stats */}
      <div className="grid grid-cols-4 gap-3 mb-3">
        <Stat icon={<MousePointerClick className="w-4 h-4" />} label="Clics" value={amb.stats.clicks} color="text-blue-300" />
        <Stat icon={<Users className="w-4 h-4" />} label="Inscrits" value={amb.stats.signups} color="text-purple-300" />
        <Stat icon={<CreditCard className="w-4 h-4" />} label="Payants" value={amb.stats.paid} color="text-emerald-300" />
        <Stat icon={<UserMinus className="w-4 h-4" />} label="Désabonnés" value={amb.stats.canceled} color="text-red-300" />
      </div>

      {/* Commission stats + payout button */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat icon={<Wallet className="w-4 h-4" />} label="Versé" value={formatEur(amb.stats.commissionsPaidCents)} color="text-emerald-300" />
        <Stat icon={<Banknote className="w-4 h-4" />} label="En attente" value={formatEur(amb.stats.commissionsPendingCents)} color="text-amber-300" />
        <button
          onClick={onPayout}
          disabled={pendingEur === 0}
          className={`rounded-xl border p-3 flex flex-col items-start justify-center transition ${
            pendingEur > 0
              ? 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-200'
              : 'border-slate-800 bg-slate-900/30 text-slate-600 cursor-not-allowed'
          }`}
        >
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide mb-1">
            <ArrowRight className="w-4 h-4" />
            <span>Versement manuel</span>
          </div>
          <div className="text-sm">{pendingEur > 0 ? `Verser ${formatEur(amb.stats.commissionsPendingCents)}` : 'Aucun pending'}</div>
        </button>
      </div>

      {/* Codes & rates */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <RateBlock
          label={`Mensuel — pool ${amb.pool_pct_monthly}%`}
          code={amb.split.monthly.code}
          discount={amb.split.monthly.discountPct}
          commission={amb.split.monthly.commissionPct}
        />
        <RateBlock
          label={`Trim. / Annuel — pool ${amb.pool_pct_qy}%`}
          code={amb.split.qy.code}
          discount={amb.split.qy.discountPct}
          commission={amb.split.qy.commissionPct}
        />
      </div>

      <div className="space-y-2">
        <LinkRow label="Lien de parrainage" value={refLink} />
        <LinkRow label="Dashboard ambassadeur" value={dashLink} external />
      </div>
    </div>
  );
}

function ConnectChip({ status, connected }: { status: string; connected: boolean }) {
  if (!connected) return <span className="px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 text-[10px] font-bold uppercase tracking-wide">Stripe non connecté</span>;
  if (status === 'onboarded') return <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 text-[10px] font-bold uppercase tracking-wide">Stripe ✓</span>;
  return <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 text-[10px] font-bold uppercase tracking-wide">Onboarding</span>;
}

function RateBlock({ label, code, discount, commission }: { label: string; code: string | null; discount: number; commission: number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">{label}</div>
      {code ? (
        <div className="font-mono text-sm font-extrabold text-white tracking-wide mb-1">{code}</div>
      ) : (
        <div className="text-xs text-slate-500 mb-1 italic">Aucun code (0% au filleul)</div>
      )}
      <div className="text-[11px] text-slate-400 flex gap-3">
        <span>Filleul <span className="text-blue-300 font-bold">-{discount}%</span></span>
        <span>Ambass. <span className="text-emerald-300 font-bold">{commission}%</span></span>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
      <div className={`flex items-center gap-1.5 text-xs ${color} mb-1`}>{icon}<span>{label}</span></div>
      <div className="text-2xl font-extrabold tabular-nums">{value}</div>
    </div>
  );
}

function LinkRow({ label, value, external }: { label: string; value: string; external?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">{label}</div>
        <div className="text-xs text-slate-300 font-mono truncate">{value}</div>
      </div>
      <button onClick={copy} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition" title="Copier">
        {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
      </button>
      {external && (
        <a href={value} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition" title="Ouvrir">
          <ExternalLink className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}

function formatEur(cents: number) {
  return `${(cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
}

// ─── AmbassadorFormModal (create + edit) ──────────────────────────────────────

function AmbassadorFormModal({ mode, password, ambassador, onClose, onSaved }: {
  mode: 'create' | 'edit';
  password: string;
  ambassador?: Ambassador;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(ambassador?.name || '');
  const [email, setEmail] = useState(ambassador?.email || '');
  const [slug, setSlug] = useState(ambassador?.slug || '');
  const [notes, setNotes] = useState(ambassador?.notes || '');
  const [adminNotes, setAdminNotes] = useState(ambassador?.admin_notes || '');
  const [poolMonthly, setPoolMonthly] = useState(ambassador?.pool_pct_monthly ?? 25);
  const [poolQy, setPoolQy] = useState(ambassador?.pool_pct_qy ?? 30);
  const [splitToFilleul, setSplitToFilleul] = useState(ambassador?.split.toFilleulPct ?? 0);
  const [splitLocked, setSplitLocked] = useState(ambassador?.split.locked ?? false);
  const [payoutDay, setPayoutDay] = useState(ambassador?.payout.dayOfMonth ?? 1);
  const [payoutMethod, setPayoutMethod] = useState<'stripe' | 'offline'>(ambassador?.payout.method ?? 'stripe');
  const [thresholdEur, setThresholdEur] = useState((ambassador?.payout.thresholdCents ?? 0) / 100);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Live preview
  const ratio = splitToFilleul / 100;
  const monthlyDisc = Math.round(poolMonthly * ratio * 100) / 100;
  const qyDisc = Math.round(poolQy * ratio * 100) / 100;
  const monthlyComm = Math.round((poolMonthly - monthlyDisc) * 100) / 100;
  const qyComm = Math.round((poolQy - qyDisc) * 100) / 100;

  const submit = async () => {
    if (!name.trim()) { setErr('Nom requis'); return; }
    setSubmitting(true);
    setErr(null);
    const body = {
      name: name.trim(),
      email: email.trim() || null,
      slug: slug.trim() || null,
      notes: notes.trim() || null,
      adminNotes: adminNotes.trim() || null,
      poolMonthlyPct: poolMonthly,
      poolQyPct: poolQy,
      initialSplitToFilleulPct: splitToFilleul,
      splitLocked,
      payoutDayOfMonth: payoutDay,
      payoutMethod,
      payoutThresholdCents: Math.round(thresholdEur * 100),
    };
    const action = mode === 'create' ? 'create' : 'update';
    const opts = mode === 'create'
      ? { method: 'POST', body }
      : { method: 'POST', body, params: { id: ambassador!.id } };
    const { ok, data } = await api(action, password, opts);
    setSubmitting(false);
    if (ok) onSaved();
    else setErr(data?.error || 'Erreur');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-[#0B1121] my-8">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h2 className="text-lg font-bold">{mode === 'create' ? 'Nouvel ambassadeur' : `Modifier ${ambassador?.name}`}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* 1. Identité */}
          <FormSection title="Identité">
            <Field label="Nom *" value={name} onChange={setName} placeholder="Thomas Dupont" />
            <Field label="Email" value={email} onChange={setEmail} placeholder="thomas@exemple.com" type="email" />
            <Field label="Slug" value={slug} onChange={setSlug} placeholder={mode === 'create' ? 'thomas (auto si vide)' : ''} mono disabled={mode === 'edit'} />
            <Field label="Notes (visibles dans la card)" value={notes} onChange={setNotes} placeholder="Provenance, profil…" textarea />
          </FormSection>

          {/* 2. Pool & split */}
          <FormSection title="Pool & répartition" subtitle="Définissez le pool % disponible et la part redistribuée au filleul">
            <SliderField
              label="Pool mensuel (% du prix payé)"
              value={poolMonthly}
              onChange={setPoolMonthly}
              min={0}
              max={100}
              suffix="%"
              hint="Total dispo à partager entre vous et l'ambassadeur sur les abos mensuels"
            />
            <SliderField
              label="Pool trimestriel/annuel (% du prix payé)"
              value={poolQy}
              onChange={setPoolQy}
              min={0}
              max={100}
              suffix="%"
              hint="Total dispo sur les abos trim/annuels"
            />
            <SliderField
              label="Part redistribuée au filleul (% du pool)"
              value={splitToFilleul}
              onChange={setSplitToFilleul}
              min={0}
              max={100}
              suffix="%"
              hint="0% = ambassadeur garde tout. 100% = tout au filleul (0 commission ambass.)"
              accent="text-blue-300"
            />
            <CheckboxField
              label="Verrouiller le split (l'ambassadeur ne peut pas le modifier lui-même)"
              checked={splitLocked}
              onChange={setSplitLocked}
            />

            {/* Preview */}
            <div className="grid grid-cols-2 gap-3">
              <PreviewCard label="Filleul mensuel (24€/mo)" pool={poolMonthly} discount={monthlyDisc} commission={monthlyComm} filleulPrice={24} />
              <PreviewCard label="Filleul trim. (60€/trim)" pool={poolQy} discount={qyDisc} commission={qyComm} filleulPrice={60} />
            </div>
          </FormSection>

          {/* 3. Versements */}
          <FormSection title="Versement des commissions" subtitle="Le cron quotidien déclenche les versements automatiquement">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-bold text-slate-400 mb-1.5">Jour du mois (1-28)</div>
                <select
                  value={payoutDay}
                  onChange={e => setPayoutDay(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/60 py-2.5 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                    <option key={d} value={d}>Jour {d}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-400 mb-1.5">Méthode</div>
                <select
                  value={payoutMethod}
                  onChange={e => setPayoutMethod(e.target.value as 'stripe' | 'offline')}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/60 py-2.5 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  <option value="stripe">Stripe Connect (auto)</option>
                  <option value="offline">Offline (virement bancaire)</option>
                </select>
              </div>
            </div>
            <Field
              label="Seuil minimum (€) avant versement"
              value={String(thresholdEur)}
              onChange={v => setThresholdEur(Number(v) || 0)}
              placeholder="0"
              hint="Si total commissions < seuil, on attend le mois suivant. 0 = versement même pour 1 centime."
            />
          </FormSection>

          {/* 4. Notes admin */}
          <FormSection title="Notes admin" subtitle="Internes — invisibles côté ambassadeur">
            <Field label="" value={adminNotes} onChange={setAdminNotes} placeholder="IBAN si offline, contrat, conditions négociées…" textarea />
          </FormSection>

          {err && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{err}</span>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-800 flex justify-end gap-2">
          <button onClick={onClose} className="px-5 py-2.5 rounded-full border border-slate-700 text-sm font-bold text-slate-300 hover:bg-slate-800 transition">Annuler</button>
          <button
            onClick={submit}
            disabled={submitting || !name.trim()}
            className="px-5 py-2.5 rounded-full bg-white text-sm font-bold text-slate-900 hover:bg-slate-200 transition disabled:opacity-50 inline-flex items-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (mode === 'create' ? 'Créer' : 'Enregistrer')}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormSection({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="border-l-2 border-blue-500/40 pl-3">
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-200">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type, mono, textarea, disabled, hint }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; mono?: boolean; textarea?: boolean; disabled?: boolean; hint?: string;
}) {
  const cls = `w-full rounded-xl border border-slate-700 bg-slate-900/60 py-2.5 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/40 ${mono ? 'font-mono' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`;
  return (
    <label className="block">
      {label && <div className="text-xs font-bold text-slate-400 mb-1.5">{label}</div>}
      {textarea ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={2} disabled={disabled} className={cls} />
      ) : (
        <input type={type || 'text'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} className={cls} />
      )}
      {hint && <p className="text-[11px] text-slate-500 mt-1">{hint}</p>}
    </label>
  );
}

function SliderField({ label, value, onChange, min, max, suffix, hint, accent }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; suffix?: string; hint?: string; accent?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-xs font-bold text-slate-400">{label}</div>
        <div className={`text-lg font-extrabold tabular-nums ${accent || 'text-white'}`}>{value}{suffix || ''}</div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-blue-500"
      />
      {hint && <p className="text-[11px] text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500/40"
      />
      <span className="text-sm text-slate-300">{label}</span>
    </label>
  );
}

function PreviewCard({ label, pool, discount, commission, filleulPrice }: {
  label: string; pool: number; discount: number; commission: number; filleulPrice: number;
}) {
  const filleulPays = Math.round(filleulPrice * (1 - discount / 100) * 100) / 100;
  const ambGets = Math.round(filleulPays * commission) / 100;
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">{label}</div>
      <div className="space-y-1 text-xs">
        <Row label="Pool" value={`${pool}%`} muted />
        <Row label="Filleul" value={`-${discount}%`} accent="text-blue-300" />
        <Row label="Ambassadeur" value={`${commission}%`} accent="text-emerald-300" bold />
        <div className="border-t border-slate-800 my-1.5" />
        <Row label="Filleul paye" value={`${filleulPays}€`} muted />
        <Row label="Comm. par paiement" value={`${ambGets}€`} accent="text-emerald-300" />
      </div>
    </div>
  );
}

function Row({ label, value, accent, muted, bold }: { label: string; value: string; accent?: string; muted?: boolean; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-slate-500' : 'text-slate-400'}>{label}</span>
      <span className={`tabular-nums ${bold ? 'font-bold' : ''} ${accent || (muted ? 'text-slate-300' : 'text-white')}`}>{value}</span>
    </div>
  );
}

// ─── PayoutModal ──────────────────────────────────────────────────────────────

type CommissionRow = {
  id: string;
  status: 'pending' | 'paid' | 'failed' | 'processing';
  commission_cents: number;
  commission_pct: number;
  invoice_amount_cents: number;
  stripe_invoice_id: string;
  stripe_subscription_id: string | null;
  stripe_transfer_id: string | null;
  payout_method: 'stripe' | 'offline' | null;
  error_message: string | null;
  created_at: string;
  paid_at: string | null;
};

function PayoutModal({ ambassador, password, onClose, onPaid }: {
  ambassador: Ambassador; password: string; onClose: () => void; onPaid: () => void;
}) {
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api('commissions', password, { params: { id: ambassador.id } }).then(({ data }) => {
      const list: CommissionRow[] = data?.commissions || [];
      setRows(list);
      // Pre-select all pending
      setSelectedIds(new Set(list.filter(r => r.status === 'pending').map(r => r.id)));
      setLoading(false);
    });
  }, [ambassador.id, password]);

  const pending = rows.filter(r => r.status === 'pending');
  const selectedRows = pending.filter(r => selectedIds.has(r.id));
  const totalSelectedCents = selectedRows.reduce((s, r) => s + Number(r.commission_cents || 0), 0);
  const canStripe = ambassador.connect.connected && ambassador.connect.status === 'onboarded';

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === pending.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(pending.map(r => r.id)));
  };

  const pay = async (mode: 'stripe' | 'offline') => {
    if (selectedRows.length === 0) return;
    if (mode === 'offline') {
      if (!confirm(`Vous confirmez avoir effectué le virement bancaire de ${formatEur(totalSelectedCents)} à ${ambassador.name} ?`)) return;
    } else {
      if (!confirm(`Lancer le transfer Stripe de ${formatEur(totalSelectedCents)} vers ${ambassador.name} maintenant ?`)) return;
    }
    setBusy(true); setErr(null);
    const { ok, data } = await api('manual-payout', password, {
      method: 'POST',
      body: { ambassadorId: ambassador.id, mode, commissionIds: Array.from(selectedIds) },
    });
    setBusy(false);
    if (ok) onPaid();
    else setErr(data?.error || 'Erreur');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-[#0B1121] my-8">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold">Versement manuel</h2>
            <p className="text-xs text-slate-400 mt-0.5">{ambassador.name} · {ambassador.slug}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>
          ) : pending.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Check className="w-10 h-10 mx-auto text-emerald-400 mb-3" />
              <p className="text-sm">Aucune commission en attente.</p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-slate-800 bg-slate-900/30 mb-4">
                <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
                  <button onClick={toggleAll} className="text-xs text-slate-400 hover:text-white">
                    {selectedIds.size === pending.length ? 'Tout décocher' : 'Tout cocher'}
                  </button>
                  <div className="text-xs text-slate-400">{selectedIds.size}/{pending.length} sélectionnée{selectedIds.size > 1 ? 's' : ''}</div>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-800">
                  {pending.map(r => (
                    <label key={r.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/30 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.id)}
                        onChange={() => toggle(r.id)}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500/40"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-xs text-slate-400 truncate">{r.stripe_invoice_id}</div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(r.created_at).toLocaleDateString('fr-FR')} · {r.commission_pct}% sur {formatEur(r.invoice_amount_cents)}
                        </div>
                      </div>
                      <div className="text-sm font-bold tabular-nums">{formatEur(r.commission_cents)}</div>
                    </label>
                  ))}
                </div>
                <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-sm text-slate-300 font-bold">Total sélectionné</span>
                  <span className="text-xl font-extrabold text-emerald-300 tabular-nums">{formatEur(totalSelectedCents)}</span>
                </div>
              </div>

              {err && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300 flex items-start gap-2 mb-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{err}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => pay('stripe')}
                  disabled={busy || selectedRows.length === 0 || !canStripe}
                  className="rounded-xl border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 p-4 text-left transition disabled:opacity-40 disabled:cursor-not-allowed"
                  title={!canStripe ? "Stripe Connect non finalisé pour cet ambassadeur" : ''}
                >
                  <div className="flex items-center gap-2 text-blue-200 font-bold mb-1">
                    <CreditCard className="w-4 h-4" />
                    <span>Stripe Connect</span>
                  </div>
                  <p className="text-xs text-slate-400">{canStripe ? 'Transfer immédiat sur le compte Stripe de l\'ambassadeur' : 'Stripe Connect non finalisé'}</p>
                </button>
                <button
                  onClick={() => pay('offline')}
                  disabled={busy || selectedRows.length === 0}
                  className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 p-4 text-left transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-2 text-emerald-200 font-bold mb-1">
                    <Banknote className="w-4 h-4" />
                    <span>Offline (virement bancaire)</span>
                  </div>
                  <p className="text-xs text-slate-400">Marque comme versé. Tu fais le virement toi-même.</p>
                </button>
              </div>
            </>
          )}

          {/* Show paid history */}
          {rows.filter(r => r.status === 'paid').length > 0 && (
            <details className="mt-6">
              <summary className="text-xs font-bold text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-200">
                Historique des versements ({rows.filter(r => r.status === 'paid').length})
              </summary>
              <div className="mt-3 max-h-48 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/30 divide-y divide-slate-800">
                {rows.filter(r => r.status === 'paid').slice(0, 50).map(r => (
                  <div key={r.id} className="px-4 py-2 flex items-center gap-3 text-xs">
                    <span className="text-slate-500 tabular-nums">{r.paid_at ? new Date(r.paid_at).toLocaleDateString('fr-FR') : '—'}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-bold uppercase">{r.payout_method || 'stripe'}</span>
                    <span className="font-mono text-slate-500 truncate flex-1">{r.stripe_transfer_id || r.stripe_invoice_id}</span>
                    <span className="font-bold tabular-nums">{formatEur(r.commission_cents)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        <div className="p-6 border-t border-slate-800 flex justify-end">
          <button onClick={onClose} className="px-5 py-2.5 rounded-full border border-slate-700 text-sm font-bold text-slate-300 hover:bg-slate-800 transition">Fermer</button>
        </div>
      </div>
    </div>
  );
}
