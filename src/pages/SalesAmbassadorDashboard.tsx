import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Loader2, MousePointerClick, Users, CreditCard, UserMinus, Copy, Check,
  Lock, Eye, EyeOff, Sparkles, ExternalLink, Settings2, Wallet, AlertCircle, Banknote, ArrowRight, X,
} from 'lucide-react';

const STORAGE_PW = 'amb_dash_pw';

type DashboardData = {
  ambassador: { name: string; slug: string; created_at: string };
  auth: { hasPassword: boolean; hasSplit: boolean };
  split: {
    toFilleulPct: number;
    lockedByAdmin: boolean;
    monthly: { pool: number; discountPct: number; commissionPct: number; code: string | null };
    qy: { pool: number; discountPct: number; commissionPct: number; code: string | null };
  };
  connect: { connected: boolean; status: string };
  stats: {
    clicks: number; signups: number; paid: number; canceled: number;
    commissionsPaidCents: number; commissionsPendingCents: number;
  };
  conversions: Array<{
    email_masked: string;
    status: 'signup' | 'paid' | 'canceled';
    signup_at: string;
    paid_at: string | null;
    canceled_at: string | null;
    billing_cycle: string | null;
    commission_pct: number | null;
    discount_pct: number | null;
  }>;
};

export default function SalesAmbassadorDashboard() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState<string | null>(() => sessionStorage.getItem(STORAGE_PW));
  const [showSplitModal, setShowSplitModal] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`/api/amb-dashboard?token=${encodeURIComponent(token)}`);
      const d = await r.json();
      if (!r.ok) { setError(d?.error || 'Erreur'); return; }
      setData(d);
    } catch {
      setError('Erreur réseau');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // Auto-prompt split modal on first auth if not yet set AND not locked by admin
  useEffect(() => {
    if (data && password && !data.auth.hasSplit && !data.split.lockedByAdmin && !showSplitModal) {
      setShowSplitModal(true);
    }
  }, [data, password, showSplitModal]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-slate-400 mb-2">Lien invalide ou expiré.</p>
          <Link to="/" className="text-blue-400 hover:text-blue-300 text-sm">Retour au site</Link>
        </div>
      </div>
    );
  }

  // Auth gate
  if (!password) {
    return (
      <AuthGate
        token={token!}
        ambassadorName={data.ambassador.name}
        hasPassword={data.auth.hasPassword}
        onAuthed={(pw) => { sessionStorage.setItem(STORAGE_PW, pw); setPassword(pw); load(); }}
      />
    );
  }

  return (
    <>
      <Dashboard
        token={token!}
        password={password}
        data={data}
        onReload={load}
        onOpenSplit={() => setShowSplitModal(true)}
        onLogout={() => { sessionStorage.removeItem(STORAGE_PW); setPassword(null); }}
      />
      {showSplitModal && (
        <SplitModal
          token={token!}
          password={password}
          initialPct={data.split.toFilleulPct}
          isFirstTime={!data.auth.hasSplit}
          monthlyPool={data.split.monthly.pool}
          qyPool={data.split.qy.pool}
          onClose={() => setShowSplitModal(false)}
          onSaved={() => { setShowSplitModal(false); load(); }}
        />
      )}
    </>
  );
}

// ─── Auth gate (set password first time, verify after) ───

function AuthGate({ token, ambassadorName, hasPassword, onAuthed }: {
  token: string; ambassadorName: string; hasPassword: boolean; onAuthed: (pw: string) => void;
}) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!hasPassword) {
      if (pw.length < 6) { setErr('Mot de passe trop court (min. 6 caractères)'); return; }
      if (pw !== pw2) { setErr('Les mots de passe ne correspondent pas'); return; }
      setBusy(true);
      const r = await fetch('/api/amb-auth?action=set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: pw }),
      });
      setBusy(false);
      if (!r.ok) { const d = await r.json().catch(() => ({})); setErr(d?.error || 'Erreur'); return; }
      onAuthed(pw);
    } else {
      setBusy(true);
      const r = await fetch('/api/amb-auth?action=verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: pw }),
      });
      setBusy(false);
      if (!r.ok) { setErr('Mot de passe incorrect'); return; }
      onAuthed(pw);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/15 opacity-30 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-purple-600/10 opacity-20 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-6">
          <img src="/logo-sales.png" alt="CloseOS" className="h-10 mx-auto mb-4" onError={e => (e.currentTarget.style.display = 'none')} />
          <p className="text-xs uppercase tracking-widest text-blue-400 font-bold">Programme Ambassadeurs</p>
          <h1 className="mt-2 text-2xl font-extrabold text-white">Bonjour {ambassadorName}</h1>
          <p className="text-slate-400 text-sm mt-1">
            {hasPassword ? 'Entrez votre mot de passe pour accéder à votre espace' : 'Créez un mot de passe pour sécuriser votre espace'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0B1121] p-6 shadow-2xl shadow-blue-900/10">
          <div className="space-y-3">
            <PwField label={hasPassword ? 'Mot de passe' : 'Choisissez un mot de passe'} value={pw} onChange={setPw} show={showPw} onToggle={() => setShowPw(s => !s)} autoFocus />
            {!hasPassword && <PwField label="Confirmer" value={pw2} onChange={setPw2} show={showPw} onToggle={() => setShowPw(s => !s)} />}
          </div>
          {err && <p className="text-xs text-red-400 mt-3 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" />{err}</p>}
          <button
            onClick={submit}
            disabled={busy || !pw}
            className="w-full mt-5 rounded-full bg-white py-3 text-sm font-bold text-slate-900 hover:bg-slate-200 transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Lock className="w-4 h-4" />{hasPassword ? 'Accéder' : 'Créer mon compte'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function PwField({ label, value, onChange, show, onToggle, autoFocus }: { label: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; autoFocus?: boolean }) {
  return (
    <label className="block">
      <div className="text-xs font-bold text-slate-400 mb-1.5">{label}</div>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoFocus={autoFocus}
          className="w-full rounded-xl border border-slate-700 bg-slate-900/60 py-2.5 pl-3 pr-10 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/40"
        />
        <button type="button" onClick={onToggle} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-white">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </label>
  );
}

// ─── Main dashboard ───

function Dashboard({ token, password, data, onReload, onOpenSplit, onLogout }: {
  token: string; password: string; data: DashboardData; onReload: () => void; onOpenSplit: () => void; onLogout: () => void;
}) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.closeos.fr';
  const refLink = `${origin}/?amb=${data.ambassador.slug}`;
  const conversionRate = data.stats.signups > 0 ? Math.round((data.stats.paid / data.stats.signups) * 100) : 0;

  const [connectBusy, setConnectBusy] = useState(false);
  const handleConnect = async () => {
    setConnectBusy(true);
    const r = await fetch('/api/amb-connect?action=onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    const d = await r.json().catch(() => ({}));
    setConnectBusy(false);
    if (d?.url) window.location.href = d.url;
  };

  const handleDashboardLink = async () => {
    const r = await fetch('/api/amb-connect?action=dashboard-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    const d = await r.json().catch(() => ({}));
    if (d?.url) window.open(d.url, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-blue-600/10 opacity-30 blur-[150px] rounded-full pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-widest text-blue-400 font-bold">Programme Ambassadeurs · CloseOS Sales</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Bonjour {data.ambassador.name}</h1>
          </div>
          <button onClick={onLogout} className="text-xs text-slate-500 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800/40 transition">Déconnexion</button>
        </div>

        {/* Hero card: ref link + main code */}
        <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-[#0F172A] to-[#0B1121] p-6 mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-72 h-72 bg-blue-500/10 blur-3xl rounded-full pointer-events-none" />
          <div className="relative">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-1">Votre lien de parrainage</div>
                <div className="text-sm text-slate-200 font-mono break-all">{refLink}</div>
              </div>
              <CopyButton value={refLink} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <CodeCard
                label="Code mensuel"
                code={data.split.monthly.code}
                discountPct={data.split.monthly.discountPct}
                commissionPct={data.split.monthly.commissionPct}
              />
              <CodeCard
                label="Code trimestriel / annuel"
                code={data.split.qy.code}
                discountPct={data.split.qy.discountPct}
                commissionPct={data.split.qy.commissionPct}
              />
            </div>

            <div className="mt-4 flex items-center justify-between text-xs">
              <div className="text-slate-400">
                Vous redistribuez <span className="text-white font-bold">{data.split.toFilleulPct}%</span> du pool à vos filleuls
              </div>
              {data.split.lockedByAdmin ? (
                <div className="inline-flex items-center gap-1.5 text-slate-500 italic">
                  <Settings2 className="w-3.5 h-3.5" />
                  Répartition définie par l'équipe CloseOS
                </div>
              ) : (
                <button onClick={onOpenSplit} className="inline-flex items-center gap-1.5 text-blue-300 hover:text-blue-200 font-bold">
                  <Settings2 className="w-3.5 h-3.5" />
                  Modifier ma répartition
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Connect status banner */}
        <ConnectBanner
          connected={data.connect.connected}
          status={data.connect.status}
          pendingCents={data.stats.commissionsPendingCents}
          busy={connectBusy}
          onConnect={handleConnect}
          onDashboard={handleDashboardLink}
        />

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
          <BigStat icon={<MousePointerClick className="w-5 h-5" />} label="Clics" value={String(data.stats.clicks)} color="text-blue-300" />
          <BigStat icon={<Users className="w-5 h-5" />} label="Inscrits" value={String(data.stats.signups)} color="text-purple-300" sub={data.stats.signups > 0 ? `${conversionRate}% conv.` : undefined} />
          <BigStat icon={<CreditCard className="w-5 h-5" />} label="Payants" value={String(data.stats.paid)} color="text-emerald-300" />
          <BigStat icon={<UserMinus className="w-5 h-5" />} label="Désabonnés" value={String(data.stats.canceled)} color="text-red-300" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <BigStat
            icon={<Wallet className="w-5 h-5" />}
            label="Commissions versées"
            value={formatEur(data.stats.commissionsPaidCents)}
            color="text-emerald-300"
            big
          />
          <BigStat
            icon={<Banknote className="w-5 h-5" />}
            label="En attente"
            value={formatEur(data.stats.commissionsPendingCents)}
            color="text-amber-300"
            sub={data.stats.commissionsPendingCents > 0 && !data.connect.connected ? 'Connectez Stripe pour recevoir' : undefined}
            big
          />
        </div>

        {/* Filleuls table */}
        <div className="rounded-2xl border border-slate-800 bg-[#0B1121] overflow-hidden mt-6">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="font-bold">Vos filleuls</h2>
              <p className="text-xs text-slate-500 mt-0.5">Emails partiellement masqués pour respecter la vie privée</p>
            </div>
            <button onClick={onReload} className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded">Actualiser</button>
          </div>
          {data.conversions.length === 0 ? (
            <div className="px-5 py-12 text-center text-slate-500 text-sm">Aucune inscription pour le moment. Partagez votre lien !</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                    <th className="text-left px-5 py-2.5">Filleul</th>
                    <th className="text-left px-3 py-2.5">Statut</th>
                    <th className="text-left px-3 py-2.5">Cycle</th>
                    <th className="text-right px-3 py-2.5">Commission</th>
                    <th className="text-right px-5 py-2.5">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {data.conversions.map((c, i) => (
                    <tr key={i} className="hover:bg-slate-900/40">
                      <td className="px-5 py-3 font-mono text-xs text-slate-300">{c.email_masked}</td>
                      <td className="px-3 py-3"><StatusBadge status={c.status} /></td>
                      <td className="px-3 py-3 text-xs text-slate-400">{cycleLabel(c.billing_cycle)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs">
                        {c.commission_pct != null ? <span className="text-emerald-300 font-bold">{c.commission_pct}%</span> : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-slate-500 tabular-nums">{formatDate(c.signup_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Connect banner ───

function ConnectBanner({ connected, status, pendingCents, busy, onConnect, onDashboard }: {
  connected: boolean; status: string; pendingCents: number; busy: boolean; onConnect: () => void; onDashboard: () => void;
}) {
  if (!connected) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0">
          <Banknote className="w-5 h-5 text-amber-300" />
        </div>
        <div className="flex-1">
          <div className="font-bold text-amber-100">Connectez votre compte bancaire</div>
          <div className="text-xs text-amber-200/70 mt-0.5">
            Pour recevoir vos commissions automatiquement, connectez Stripe (gratuit, 2 minutes).
            {pendingCents > 0 && <span className="font-bold"> {formatEur(pendingCents)} en attente.</span>}
          </div>
        </div>
        <button
          onClick={onConnect}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-slate-900 hover:bg-slate-100 transition disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>Connecter Stripe<ArrowRight className="w-3.5 h-3.5" /></>}
        </button>
      </div>
    );
  }

  if (status === 'onboarded') {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
          <Check className="w-5 h-5 text-emerald-300" />
        </div>
        <div className="flex-1">
          <div className="font-bold text-emerald-100">Compte connecté</div>
          <div className="text-xs text-emerald-200/70 mt-0.5">Vos commissions sont versées automatiquement.</div>
        </div>
        <button
          onClick={onDashboard}
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-100 hover:bg-emerald-500/20 transition"
        >
          Mon dashboard Stripe<ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // onboarding/restricted
  return (
    <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-blue-500/15 flex items-center justify-center flex-shrink-0">
        <AlertCircle className="w-5 h-5 text-blue-300" />
      </div>
      <div className="flex-1">
        <div className="font-bold text-blue-100">Onboarding Stripe à finaliser</div>
        <div className="text-xs text-blue-200/70 mt-0.5">Quelques infos manquent pour activer les versements.</div>
      </div>
      <button
        onClick={onConnect}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-slate-900 hover:bg-slate-100 transition disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>Reprendre<ArrowRight className="w-3.5 h-3.5" /></>}
      </button>
    </div>
  );
}

// ─── Code card ───

function CodeCard({ label, code, discountPct, commissionPct }: { label: string; code: string | null; discountPct: number; commissionPct: number }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">{label}</div>
      <div className="flex items-center justify-between gap-2">
        {code ? (
          <div className="flex-1">
            <div className="font-mono text-lg font-extrabold tracking-wide">{code}</div>
            <div className="text-xs text-slate-400 mt-0.5">-{discountPct}% pour le filleul · {commissionPct}% pour vous</div>
          </div>
        ) : (
          <div className="flex-1">
            <div className="text-sm text-slate-500">Pas de code (0% au filleul)</div>
            <div className="text-xs text-slate-400 mt-0.5">Vous touchez {commissionPct}% du prix</div>
          </div>
        )}
        {code && <CopyButton value={code} small />}
      </div>
    </div>
  );
}

function CopyButton({ value, small }: { value: string; small?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <button onClick={copy} className={`inline-flex items-center gap-1.5 rounded-full bg-white text-slate-900 hover:bg-slate-200 transition ${small ? 'px-2.5 py-1 text-[11px]' : 'px-4 py-2 text-xs'} font-bold flex-shrink-0`}>
      {copied ? <><Check className={small ? 'w-3 h-3' : 'w-3.5 h-3.5'} />Copié</> : <><Copy className={small ? 'w-3 h-3' : 'w-3.5 h-3.5'} />Copier</>}
    </button>
  );
}

function BigStat({ icon, label, value, color, sub, big }: { icon: React.ReactNode; label: string; value: string; color: string; sub?: string; big?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0B1121] p-4">
      <div className={`flex items-center gap-1.5 text-xs ${color} mb-2`}>{icon}<span className="font-bold uppercase tracking-wide">{label}</span></div>
      <div className={`${big ? 'text-2xl' : 'text-3xl'} font-extrabold tabular-nums`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: 'signup' | 'paid' | 'canceled' }) {
  const map = {
    signup: { label: 'Essai', cls: 'bg-amber-500/10 text-amber-300 border-amber-500/20' },
    paid: { label: 'Payant', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' },
    canceled: { label: 'Désabonné', cls: 'bg-red-500/10 text-red-300 border-red-500/20' },
  };
  const m = map[status];
  return <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${m.cls}`}>{m.label}</span>;
}

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }); } catch { return ''; }
}

function formatEur(cents: number) {
  return `${(cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function cycleLabel(c: string | null) {
  if (c === 'monthly') return 'Mensuel';
  if (c === 'quarterly') return 'Trimestriel';
  if (c === 'yearly') return 'Annuel';
  return '—';
}

// ─── Split modal ───

function SplitModal({ token, password, initialPct, isFirstTime, monthlyPool, qyPool, onClose, onSaved }: {
  token: string; password: string; initialPct: number; isFirstTime: boolean; monthlyPool: number; qyPool: number; onClose: () => void; onSaved: () => void;
}) {
  const [pct, setPct] = useState(initialPct);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Live preview (uses the ambassador's actual pool, not hardcoded constants)
  const monthlyDisc = Math.round(monthlyPool * (pct / 100) * 100) / 100;
  const qyDisc = Math.round(qyPool * (pct / 100) * 100) / 100;
  const monthlyComm = Math.round((monthlyPool - monthlyDisc) * 100) / 100;
  const qyComm = Math.round((qyPool - qyDisc) * 100) / 100;

  const save = async () => {
    setBusy(true); setErr(null);
    const r = await fetch('/api/amb-split', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password, splitToFilleulPct: pct }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(d?.error || 'Erreur'); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-[#0B1121] overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/15 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold">{isFirstTime ? 'Bienvenue !' : 'Modifier ma répartition'}</h2>
              <p className="text-sm text-slate-400 mt-1">
                {isFirstTime
                  ? `${qyPool}% (annuel/trim) ou ${monthlyPool}% (mensuel) sont à votre disposition. Comment voulez-vous les utiliser ?`
                  : 'Ajustez la part que vous donnez à vos filleuls.'}
              </p>
            </div>
          </div>
          {!isFirstTime && (
            <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"><X className="w-5 h-5" /></button>
          )}
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Part redistribuée au filleul</div>
            <div className="text-3xl font-extrabold tabular-nums text-blue-300">{pct}%</div>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={pct}
            onChange={e => setPct(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>0% (vous gardez tout)</span>
            <span>100% (filleul prend tout)</span>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <PreviewCard
              label="Filleul mensuel"
              pool={monthlyPool}
              discount={monthlyDisc}
              commission={monthlyComm}
              filleulPrice={24}
            />
            <PreviewCard
              label="Filleul trim/annuel"
              pool={qyPool}
              discount={qyDisc}
              commission={qyComm}
              filleulPrice={20}
            />
          </div>

          <p className="text-[11px] text-slate-500 mt-4 leading-relaxed">
            💡 Vos filleuls actuels gardent leur taux à vie. Ce changement ne s'applique qu'aux nouveaux filleuls qui s'inscrivent à partir de maintenant.
          </p>

          {err && <p className="text-xs text-red-400 mt-3 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" />{err}</p>}

          <button
            onClick={save}
            disabled={busy}
            className="w-full mt-5 rounded-full bg-white py-3 text-sm font-bold text-slate-900 hover:bg-slate-200 transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : isFirstTime ? 'Valider et accéder à mon dashboard' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewCard({ label, pool, discount, commission, filleulPrice }: { label: string; pool: number; discount: number; commission: number; filleulPrice: number }) {
  const filleulPays = Math.round(filleulPrice * (1 - discount / 100) * 100) / 100;
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">{label}</div>
      <div className="space-y-1.5 text-xs">
        <Row label="Pool partagé" value={`${pool}%`} muted />
        <Row label="Discount filleul" value={`-${discount}%`} accent="text-blue-300" />
        <Row label="Votre commission" value={`${commission}%`} accent="text-emerald-300" bold />
        <div className="border-t border-slate-800 my-2" />
        <Row label="Prix filleul" value={`${filleulPays}€`} muted />
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
