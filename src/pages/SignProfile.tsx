import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  User, Mail, Phone, MapPin, FileDigit, Hash, Percent, Landmark, Tag, Briefcase, Loader2, CheckCircle2,
  Settings, UserRound, LogOut, ShieldCheck, CreditCard, ExternalLink, Lock, Smartphone, Bell, Download,
  AlertCircle, Power, Trash2, ArrowRight,
} from 'lucide-react';
import {
  getOwnerProfile, updateOwnerProfile, getOwnerStripeStatus, getNotifPrefs, updateNotifPrefs,
  getAccountInfo, exportOwnerData, type OwnerProfile, type NotifPrefs,
} from '../lib/signContracts';
import { listTrustedDevices, revokeTrustedDevice, revokeAllTrustedDevices, type TrustedDevice } from '../lib/signDevice';
import { getSignSubscription, isSubActive, openSignBillingPortal, type SignSubscription } from '../lib/signSubscription';
import { signSupabase as supabase } from '../lib/signSupabase';
import { signOutSign, changePassword, useSignOwner } from '../lib/signAuth';
import PhoneInput from '../components/PhoneInput';
import PlacesInput from '../components/PlacesInput';

/**
 * CloseOS Sign — Profil du propriétaire (compte sign_users) + Paramètres réels.
 * Profil : infos qui préremplissent les champs PROPRIÉTAIRE des contrats.
 * Paramètres : compte, mot de passe (ré-auth), appareils de confiance (2FA), notifications,
 *              paiement Stripe, export RGPD, sessions.
 */
const EMPTY: OwnerProfile = { full_name: '', email: '', phone: '', company: '', address: '', city: '', siret: '', siren: '', tva: '', company_id: '', ape: '' };

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

const pwInputCls =
  'w-full rounded border border-[#3A4242] bg-[#191E1E] py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-[#A1A9A9]/40 focus:border-[#CEFF8F]';

export default function SignProfile() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'parametres' ? 'parametres' : 'profil';
  const [form, setForm] = useState<OwnerProfile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [stripeBusy, setStripeBusy] = useState(false);
  const { owner } = useSignOwner();
  const user = owner?.name ?? '…';

  // ── Paramètres : état ──
  const [account, setAccount] = useState<{ email: string; createdAt: string | null }>({ email: '', createdAt: null });
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [devices, setDevices] = useState<TrustedDevice[] | null>(null);
  const [deviceBusy, setDeviceBusy] = useState<string | null>(null);
  const [notif, setNotif] = useState<NotifPrefs | null>(null);
  const [exporting, setExporting] = useState(false);
  const [outAllBusy, setOutAllBusy] = useState(false);
  const [sub, setSub] = useState<SignSubscription | null>(null);

  useEffect(() => {
    document.title = 'Mon profil | CloseOS Sign';
    getOwnerProfile()
      .then((p) => setForm({ ...EMPTY, ...p }))
      .catch((e) => console.error('[sign] profil', e))
      .finally(() => setLoading(false));
    if (!owner) return;
    if (params.get('stripe_connected') === '1') {
      supabase.functions
        .invoke('sign-pay', { body: { action: 'connect-status', ownerId: owner.id } })
        .then(({ data }) => setStripeConnected(!!data?.connected))
        .catch(() => {});
    } else {
      getOwnerStripeStatus().then((s) => setStripeConnected(s.connected)).catch(() => {});
    }
  }, [params, owner]);

  // Données des paramètres (compte + notifications) à l'ouverture de l'onglet.
  useEffect(() => {
    if (tab !== 'parametres' || !owner) return;
    getAccountInfo().then(setAccount).catch(() => {});
    getNotifPrefs().then(setNotif).catch(() => {});
    getSignSubscription().then(setSub).catch(() => {});
  }, [tab, owner]);

  // Appareils de confiance (chargés une fois).
  useEffect(() => {
    if (tab === 'parametres' && owner && devices === null) {
      listTrustedDevices().then(setDevices).catch(() => setDevices([]));
    }
  }, [tab, owner, devices]);

  const connectStripe = async () => {
    setStripeBusy(true);
    try {
      const { data } = await supabase.functions.invoke('sign-pay', {
        body: { action: 'connect', ownerId: owner?.id, email: form.email || undefined, origin: window.location.origin },
      });
      if (data?.url) window.location.href = data.url as string;
      else window.alert('Connexion Stripe indisponible (clé Stripe non configurée ?).');
    } catch {
      window.alert('Connexion Stripe impossible.');
    } finally {
      setStripeBusy(false);
    }
  };

  const set = (k: keyof OwnerProfile, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateOwnerProfile(form);
      setSaved(true);
    } catch (err) {
      console.error('[sign] sauvegarde profil', err);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOutSign();
    navigate('/sign/login', { replace: true });
  };

  // ── Paramètres : handlers ──
  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (pw.next.length < 6) return setPwMsg({ type: 'err', text: 'Le nouveau mot de passe doit faire au moins 6 caractères.' });
    if (pw.next !== pw.confirm) return setPwMsg({ type: 'err', text: 'Les deux mots de passe ne correspondent pas.' });
    setPwBusy(true);
    const r = await changePassword(pw.current, pw.next);
    setPwBusy(false);
    if (r.ok) {
      setPwMsg({ type: 'ok', text: 'Mot de passe mis à jour.' });
      setPw({ current: '', next: '', confirm: '' });
    } else {
      setPwMsg({ type: 'err', text: r.error === 'wrong_current' ? 'Mot de passe actuel incorrect.' : 'Échec de la mise à jour.' });
    }
  };

  const revokeOne = async (id: string) => {
    setDeviceBusy(id);
    await revokeTrustedDevice(id);
    setDevices((ds) => (ds ?? []).filter((d) => d.id !== id));
    setDeviceBusy(null);
  };

  const toggleNotif = async (key: keyof NotifPrefs, val: boolean) => {
    setNotif((n) => (n ? { ...n, [key]: val } : n));
    try {
      await updateNotifPrefs({ [key]: val });
    } catch {
      setNotif((n) => (n ? { ...n, [key]: !val } : n));
    }
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const data = await exportOwnerData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `closeos-sign-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[sign] export', err);
      window.alert("L'export a échoué.");
    } finally {
      setExporting(false);
    }
  };

  const signOutEverywhere = async () => {
    setOutAllBusy(true);
    try { await revokeAllTrustedDevices(); } catch { /* noop */ }
    try { await supabase.auth.signOut({ scope: 'global' }); } catch { /* noop */ }
    navigate('/sign/login', { replace: true });
  };

  const TABS = [
    { id: 'profil', label: 'Profil', icon: UserRound },
    { id: 'parametres', label: 'Paramètres', icon: Settings },
  ];

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 md:px-10">
      {/* En-tête */}
      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#CEFF8F] text-xl font-bold text-[#191E1E]">
          {(form.full_name || user).slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">{form.full_name || user}</h1>
          <p className="text-sm text-[#A1A9A9]">{form.email || 'Compte CloseOS Sign'}</p>
        </div>
      </div>

      {/* Onglets */}
      <div className="mb-6 flex gap-1 border-b border-[#3A4242]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setParams(t.id === 'profil' ? {} : { tab: t.id })}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.id ? 'border-[#CEFF8F] text-[#CEFF8F]' : 'border-transparent text-[#A1A9A9] hover:text-white'
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-[#A1A9A9]">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </div>
      ) : tab === 'profil' ? (
        <form onSubmit={save} className="space-y-5">
          <p className="rounded-lg border border-[#3A4242] bg-[#222828] px-4 py-3 text-xs text-[#A1A9A9]">
            Ces informations préremplissent automatiquement <span className="text-[#A0E7EC]">vos champs (propriétaire)</span> dans les contrats
            — sauf la signature, la date et l’heure.
          </p>

          <Field icon={User} label="Nom complet" value={form.full_name} onChange={(v) => set('full_name', v)} placeholder="Thomas Shamoev" />

          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">
              Email du compte <span className="text-[#A1A9A9]/60">(non modifiable)</span>
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
              <input
                value={form.email}
                disabled
                className="w-full cursor-not-allowed rounded border border-[#3A4242] bg-[#191E1E]/60 py-2.5 pl-10 pr-4 text-sm text-[#A1A9A9] outline-none"
              />
            </div>
          </div>

          <Field icon={Briefcase} label="Entreprise / Dénomination" value={form.company} onChange={(v) => set('company', v)} placeholder="CloseOS SAS" />

          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">Téléphone</label>
            <PhoneInput value={form.phone} onChange={(v) => set('phone', v)} />
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">Adresse complète</label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
              <PlacesInput variant="dark" mode="address" value={form.address} onChange={(v) => set('address', v)} placeholder="12 rue de Paris, 75001 Paris" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field icon={FileDigit} label="SIRET" value={form.siret} onChange={(v) => set('siret', v)} placeholder="ex. 14 chiffres (FR)" />
            <Field icon={Hash} label="SIREN" value={form.siren} onChange={(v) => set('siren', v)} placeholder="ex. 9 chiffres (FR)" />
            <Field icon={Percent} label="N° de TVA" value={form.tva} onChange={(v) => set('tva', v)} placeholder="ex. FR12345678901" />
            <Field icon={Landmark} label="N° d'entreprise" value={form.company_id} onChange={(v) => set('company_id', v)} placeholder="Registre national" />
            <Field icon={Tag} label="Code APE/NAF" value={form.ape} onChange={(v) => set('ape', v)} placeholder="ex. 6201Z" />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 rounded bg-[#CEFF8F] px-5 py-2.5 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC] disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Enregistrer
            </button>
            {saved && <span className="text-sm text-[#CEFF8F]">Profil enregistré ✓</span>}
          </div>
        </form>
      ) : (
        /* ─────────── Paramètres ─────────── */
        <div className="space-y-4">
          {/* Compte */}
          <SettingCard icon={UserRound} title="Compte">
            <div className="flex items-center justify-between border-b border-[#3A4242] py-2.5">
              <span className="text-sm text-[#A1A9A9]">Email</span>
              <span className="text-sm font-medium text-white">{account.email || form.email || '—'}</span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-sm text-[#A1A9A9]">Membre depuis</span>
              <span className="text-sm font-medium text-white">{fmtDate(account.createdAt)}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[#A1A9A9]">
              Votre identifiant CloseOS est partagé entre <span className="text-[#F3F4F6]">Business</span> et <span className="text-[#CEFF8F]">Sign</span>.
            </p>
          </SettingCard>

          {/* Abonnement */}
          <SettingCard icon={CreditCard} title="Abonnement">
            {sub?.exempt ? (
              <p className="text-sm leading-relaxed text-[#A1A9A9]">
                CloseOS Sign est <span className="text-[#CEFF8F]">inclus</span> avec votre abonnement CloseOS Business — sans frais supplémentaires.
              </p>
            ) : sub && isSubActive(sub.status) ? (
              <>
                <div className="flex items-center justify-between border-b border-[#3A4242] py-2.5">
                  <span className="text-sm text-[#A1A9A9]">Statut</span>
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#CEFF8F]">
                    <CheckCircle2 className="h-4 w-4" /> {sub.status === 'trialing' ? 'Essai en cours' : 'Actif'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-[#A1A9A9]">{sub.status === 'trialing' ? 'Fin de l’essai' : 'Renouvellement'}</span>
                  <span className="text-sm font-medium text-white">{fmtDate(sub.currentPeriodEnd)}</span>
                </div>
                <button onClick={() => openSignBillingPortal()} className="mt-2 inline-flex items-center gap-2 rounded-lg border border-[#3A4242] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:border-[#CEFF8F]">
                  <ExternalLink className="h-4 w-4" /> Gérer l’abonnement
                </button>
              </>
            ) : (
              <>
                <p className="mb-4 text-sm text-[#A1A9A9]">
                  Activez CloseOS Sign — toutes les fonctionnalités, à partir de <span className="text-[#F3F4F6]">9 €/mois</span>. 14 jours d’essai gratuit.
                </p>
                <button onClick={() => navigate('/sign/abonnement')} className="inline-flex items-center gap-2 rounded-lg bg-[#CEFF8F] px-4 py-2.5 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC]">
                  S’abonner <ArrowRight className="h-4 w-4" />
                </button>
              </>
            )}
          </SettingCard>

          {/* Mot de passe */}
          <SettingCard
            icon={Lock}
            title="Mot de passe"
            desc="C’est le mot de passe de votre compte CloseOS (Business et Sign) — le modifier ici le change partout."
          >
            <form onSubmit={submitPassword} className="space-y-3">
              <PwInput placeholder="Mot de passe actuel" autoComplete="current-password" value={pw.current} onChange={(v) => { setPw((p) => ({ ...p, current: v })); setPwMsg(null); }} />
              <PwInput placeholder="Nouveau mot de passe" autoComplete="new-password" value={pw.next} onChange={(v) => { setPw((p) => ({ ...p, next: v })); setPwMsg(null); }} />
              <PwInput placeholder="Confirmer le nouveau mot de passe" autoComplete="new-password" value={pw.confirm} onChange={(v) => { setPw((p) => ({ ...p, confirm: v })); setPwMsg(null); }} />
              {pwMsg && (
                <div className={`flex items-center gap-2 rounded border px-3 py-2 text-xs ${pwMsg.type === 'ok' ? 'border-[#CEFF8F]/30 bg-[#CEFF8F]/10 text-[#CEFF8F]' : 'border-[#ef6b6b]/30 bg-[#ef6b6b]/10 text-[#ef6b6b]'}`}>
                  {pwMsg.type === 'ok' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />} {pwMsg.text}
                </div>
              )}
              <button
                type="submit"
                disabled={pwBusy || !pw.current || !pw.next || !pw.confirm}
                className="inline-flex items-center gap-2 rounded bg-[#CEFF8F] px-4 py-2.5 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC] disabled:opacity-50"
              >
                {pwBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Mettre à jour le mot de passe
              </button>
            </form>
          </SettingCard>

          {/* Appareils de confiance */}
          <SettingCard
            icon={Smartphone}
            title="Appareils de confiance"
            desc="Appareils où la vérification (code email) a réussi. Chacun reste de confiance 7 jours, puis une nouvelle vérification est demandée."
          >
            {devices === null ? (
              <div className="flex items-center gap-2 text-sm text-[#A1A9A9]"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
            ) : devices.length === 0 ? (
              <p className="text-sm text-[#A1A9A9]">Aucun appareil de confiance actif.</p>
            ) : (
              <div className="space-y-2">
                {devices.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#3A4242] bg-[#191E1E] px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-white">
                        <Smartphone className="h-4 w-4 shrink-0 text-[#A1A9A9]" />
                        {d.device_name || 'Appareil'}
                        {d.current && <span className="rounded-full bg-[#CEFF8F]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#CEFF8F]">Cet appareil</span>}
                      </div>
                      <div className="mt-1 truncate text-xs text-[#A1A9A9]">
                        {[d.location, d.last_ip].filter(Boolean).join(' · ') || 'Localisation inconnue'} — ajouté le {fmtDate(d.created_at)}
                      </div>
                    </div>
                    <button
                      onClick={() => revokeOne(d.id)}
                      disabled={deviceBusy === d.id}
                      className="shrink-0 rounded-lg border border-[#3A4242] px-3 py-1.5 text-xs font-medium text-[#A1A9A9] transition-colors hover:border-[#ef6b6b]/40 hover:text-[#ef6b6b] disabled:opacity-50"
                    >
                      {deviceBusy === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Révoquer'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </SettingCard>

          {/* Notifications */}
          <SettingCard icon={Bell} title="Notifications">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-white">Connexion sur un nouvel appareil</div>
                <div className="text-xs text-[#A1A9A9]">Recevez un email de sécurité à chaque connexion vérifiée sur un nouvel appareil.</div>
              </div>
              <Toggle checked={notif?.new_device ?? true} disabled={!notif} onChange={(v) => toggleNotif('new_device', v)} />
            </div>
          </SettingCard>

          {/* Paiement Stripe */}
          <SettingCard
            icon={CreditCard}
            title="Paiement Stripe"
            desc="Connecte ton compte Stripe pour proposer « Payé + signé » : le signataire paie pour valider, l’argent arrive directement sur ton compte."
          >
            {stripeConnected ? (
              <div className="flex items-center gap-2 rounded-lg border border-[#CEFF8F]/30 bg-[#CEFF8F]/10 px-3 py-2.5 text-sm font-medium text-[#CEFF8F]">
                <CheckCircle2 className="h-4 w-4" /> Compte Stripe connecté
              </div>
            ) : (
              <button
                onClick={connectStripe}
                disabled={stripeBusy}
                className="inline-flex items-center gap-2 rounded-lg bg-[#CEFF8F] px-4 py-2.5 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC] disabled:opacity-50"
              >
                {stripeBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />} Connecter mon compte Stripe
              </button>
            )}
          </SettingCard>

          {/* Données & confidentialité */}
          <SettingCard
            icon={ShieldCheck}
            title="Données & confidentialité"
            desc="Signature électronique conforme RGPD. Chaque signature génère un faisceau de preuves (horodatage, ouvertures du lien, appareil) conservé avec le contrat."
          >
            <button
              onClick={exportData}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-lg border border-[#3A4242] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:border-[#CEFF8F] disabled:opacity-50"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Télécharger mes données (JSON)
            </button>
            <p className="mt-3 text-xs text-[#A1A9A9]">Export de votre profil, vos contrats et vos contacts.</p>
          </SettingCard>

          {/* Sessions */}
          <SettingCard icon={Power} title="Sessions">
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 rounded-lg border border-[#3A4242] px-4 py-2.5 text-sm font-medium text-[#A1A9A9] transition-colors hover:border-[#A1A9A9] hover:text-white"
              >
                <LogOut className="h-4 w-4" /> Se déconnecter
              </button>
              <button
                onClick={signOutEverywhere}
                disabled={outAllBusy}
                className="flex items-center justify-center gap-2 rounded-lg border border-[#ef6b6b]/30 px-4 py-2.5 text-sm font-medium text-[#ef6b6b] transition-colors hover:bg-[#ef6b6b]/10 disabled:opacity-50"
              >
                {outAllBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Déconnexion de tous les appareils
              </button>
            </div>
          </SettingCard>
        </div>
      )}
    </div>
  );
}

function SettingCard({ icon: Icon, title, desc, children }: { icon: typeof User; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#3A4242] bg-[#222828] p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <Icon className="h-4 w-4 text-[#CEFF8F]" /> {title}
      </div>
      {desc && <p className="mb-4 mt-1.5 text-xs leading-relaxed text-[#A1A9A9]">{desc}</p>}
      <div className={desc ? '' : 'mt-4'}>{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-[#CEFF8F]' : 'bg-[#3A4242]'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

function PwInput({ value, onChange, placeholder, autoComplete }: { value: string; onChange: (v: string) => void; placeholder: string; autoComplete: string }) {
  return (
    <div className="relative">
      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
      <input
        type="password"
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={pwInputCls}
      />
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
}: {
  icon: typeof User;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">{label}</label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded border border-[#3A4242] bg-[#191E1E] py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-[#A1A9A9]/40 focus:border-[#CEFF8F]"
        />
      </div>
    </div>
  );
}
