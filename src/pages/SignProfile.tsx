import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  User, Mail, Phone, MapPin, FileDigit, Hash, Percent, Landmark, Tag, Briefcase, Loader2, CheckCircle2,
  Settings, UserRound, LogOut, ShieldCheck, CreditCard, ExternalLink, Lock, Smartphone, Bell, Download,
  AlertCircle, Power, Trash2, ArrowRight, Camera, Plug, Copy, Check, RefreshCw,
} from 'lucide-react';
import {
  getOwnerProfile, updateOwnerProfile, getOwnerStripeStatus, getNotifPrefs, updateNotifPrefs,
  getAccountInfo, exportOwnerData, getOwnerAvatar, uploadSignAvatar, type OwnerProfile, type NotifPrefs,
} from '../lib/signContracts';
import { getMcpKey, generateMcpKey, revokeMcpKey, mcpConnectorUrl } from '../lib/signTeam';
import { listTrustedDevices, revokeTrustedDevice, revokeAllTrustedDevices, type TrustedDevice } from '../lib/signDevice';
import { getSignSubscription, isSubActive, openSignBillingPortal, type SignSubscription } from '../lib/signSubscription';
import { signSupabase as supabase } from '../lib/signSupabase';
import { signOutSign, changePassword, updatePassword, getAuthIdentity, useSignOwner } from '../lib/signAuth';
import PhoneInput from '../components/PhoneInput';
import PlacesInput from '../components/PlacesInput';
import { useSignLang, signLocale, type SignLang } from '../contexts/SignLangContext';

/**
 * CloseOS Sign — Profil du propriétaire (compte sign_users) + Paramètres réels.
 * Profil : infos qui préremplissent les champs PROPRIÉTAIRE des contrats.
 * Paramètres : compte, mot de passe (ré-auth), appareils de confiance (2FA), notifications,
 *              paiement Stripe, export RGPD, sessions.
 */
const EMPTY: OwnerProfile = { full_name: '', email: '', phone: '', company: '', address: '', city: '', siret: '', siren: '', tva: '', company_id: '', ape: '' };

const fmtDate = (iso: string | null, lang: SignLang) =>
  iso ? new Date(iso).toLocaleDateString(signLocale(lang), { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

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
  const { lang } = useSignLang();
  const user = owner?.name ?? '…';

  // ── Photo de profil ──
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFromBusiness, setAvatarFromBusiness] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { window.alert(lang === 'fr' ? 'Choisissez un fichier image.' : 'Please choose an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { window.alert(lang === 'fr' ? 'Image trop lourde (max 5 Mo).' : 'Image too large (max 5 MB).'); return; }
    setAvatarBusy(true);
    try {
      const url = await uploadSignAvatar(file);
      setAvatarUrl(url);
    } catch {
      window.alert(lang === 'fr' ? "Échec de l'envoi de la photo. Réessayez." : 'Photo upload failed. Please try again.');
    } finally {
      setAvatarBusy(false);
    }
  };

  // ── Paramètres : état ──
  const [account, setAccount] = useState<{ email: string; createdAt: string | null }>({ email: '', createdAt: null });
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [authId, setAuthId] = useState<{ hasPassword: boolean; google: boolean } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [devices, setDevices] = useState<TrustedDevice[] | null>(null);
  const [deviceBusy, setDeviceBusy] = useState<string | null>(null);
  const [notif, setNotif] = useState<NotifPrefs | null>(null);
  const [exporting, setExporting] = useState(false);
  const [outAllBusy, setOutAllBusy] = useState(false);
  const [sub, setSub] = useState<SignSubscription | null>(null);
  // ── Connecteur MCP ──
  const [mcpKey, setMcpKey] = useState<string | null>(null);
  const [mcpLoaded, setMcpLoaded] = useState(false);
  const [mcpBusy, setMcpBusy] = useState(false);
  const [mcpCopied, setMcpCopied] = useState(false);

  useEffect(() => {
    document.title = lang === 'fr' ? 'Mon profil | CloseOS Sign' : 'My profile | CloseOS Sign';
    getOwnerProfile()
      .then((p) => setForm({ ...EMPTY, ...p }))
      .catch((e) => console.error('[sign] profil', e))
      .finally(() => setLoading(false));
    getOwnerAvatar()
      .then((av) => { setAvatarUrl(av.url); setAvatarFromBusiness(av.fromBusiness); })
      .catch(() => {});
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
    getAuthIdentity().then(setAuthId).catch(() => {});
    getNotifPrefs().then(setNotif).catch(() => {});
    getSignSubscription().then(setSub).catch(() => {});
    getMcpKey().then((k) => { setMcpKey(k); setMcpLoaded(true); }).catch(() => setMcpLoaded(true));
  }, [tab, owner]);

  const genMcp = async () => {
    setMcpBusy(true);
    try { const k = await generateMcpKey(); setMcpKey(k); } catch (e) { console.error('[sign] génération clé MCP', e); }
    finally { setMcpBusy(false); }
  };
  const revokeMcp = async () => {
    if (!confirm(lang === 'fr' ? 'Désactiver le connecteur MCP ? Le lien actuel cessera de fonctionner.' : 'Disable the MCP connector? The current link will stop working.')) return;
    setMcpBusy(true);
    try { await revokeMcpKey(); setMcpKey(null); } catch (e) { console.error('[sign] révocation clé MCP', e); }
    finally { setMcpBusy(false); }
  };
  const copyMcp = async () => {
    if (!mcpKey) return;
    try { await navigator.clipboard.writeText(mcpConnectorUrl(mcpKey)); setMcpCopied(true); setTimeout(() => setMcpCopied(false), 1800); } catch { /* noop */ }
  };

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
      else window.alert(lang === 'fr' ? 'Connexion Stripe indisponible (clé Stripe non configurée ?).' : 'Stripe connection unavailable (Stripe key not configured?).');
    } catch {
      window.alert(lang === 'fr' ? 'Connexion Stripe impossible.' : 'Unable to connect to Stripe.');
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
    if (pw.next.length < 6) return setPwMsg({ type: 'err', text: lang === 'fr' ? 'Le nouveau mot de passe doit faire au moins 6 caractères.' : 'The new password must be at least 6 characters.' });
    if (pw.next !== pw.confirm) return setPwMsg({ type: 'err', text: lang === 'fr' ? 'Les deux mots de passe ne correspondent pas.' : 'The two passwords do not match.' });
    setPwBusy(true);
    // Compte sans mot de passe (connexion Google) → on en définit un, sans « mot de passe actuel ».
    const noPassword = authId?.hasPassword === false;
    const r = noPassword ? await updatePassword(pw.next) : await changePassword(pw.current, pw.next);
    setPwBusy(false);
    if (r.ok) {
      setPwMsg({ type: 'ok', text: noPassword ? (lang === 'fr' ? 'Mot de passe défini. Vous pouvez désormais vous connecter par email.' : 'Password set. You can now also sign in with your email.') : (lang === 'fr' ? 'Mot de passe mis à jour.' : 'Password updated.') });
      setPw({ current: '', next: '', confirm: '' });
      if (noPassword) setAuthId((a) => (a ? { ...a, hasPassword: true } : a));
    } else {
      setPwMsg({ type: 'err', text: r.error === 'wrong_current' ? (lang === 'fr' ? 'Mot de passe actuel incorrect.' : 'Current password is incorrect.') : (lang === 'fr' ? 'Échec de la mise à jour.' : 'Update failed.') });
    }
  };

  const linkGoogleSign = async () => {
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/sign/app/profil` },
      });
      if (error) throw error;
    } catch (e: any) {
      setPwMsg({ type: 'err', text: lang === 'fr' ? `Impossible d'associer Google : ${e?.message || 'erreur'}.` : `Could not link Google: ${e?.message || 'error'}.` });
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
      window.alert(lang === 'fr' ? "L'export a échoué." : 'Export failed.');
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
    { id: 'profil', label: lang === 'fr' ? 'Profil' : 'Profile', icon: UserRound },
    { id: 'parametres', label: lang === 'fr' ? 'Paramètres' : 'Settings', icon: Settings },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10 md:px-10">
      {/* En-tête */}
      <div className="mb-8 flex items-center gap-4">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
        <button
          type="button"
          onClick={() => { if (!avatarFromBusiness && !avatarBusy) fileRef.current?.click(); }}
          disabled={avatarFromBusiness || avatarBusy}
          title={avatarFromBusiness ? (lang === 'fr' ? 'Photo synchronisée depuis CloseOS Business' : 'Photo synced from CloseOS Business') : (lang === 'fr' ? 'Changer la photo de profil' : 'Change profile photo')}
          className={`group relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#CEFF8F] text-xl font-bold text-[#191E1E] ${avatarFromBusiness ? 'cursor-default' : 'cursor-pointer'}`}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={lang === 'fr' ? 'Photo de profil' : 'Profile photo'} className="h-full w-full object-cover" />
          ) : (
            (form.full_name || user).slice(0, 1).toUpperCase()
          )}
          {!avatarFromBusiness && !avatarBusy && (
            <span className="absolute inset-0 hidden items-center justify-center bg-black/55 text-white group-hover:flex">
              <Camera className="h-5 w-5" />
            </span>
          )}
          {avatarBusy && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-white">
              <Loader2 className="h-5 w-5 animate-spin" />
            </span>
          )}
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">{form.full_name || user}</h1>
          <p className="truncate text-sm text-[#A1A9A9]">{form.email || (lang === 'fr' ? 'Compte CloseOS Sign' : 'CloseOS Sign account')}</p>
          {avatarFromBusiness && (
            <p className="mt-0.5 text-[11px] text-[#A1A9A9]">{lang === 'fr' ? 'Photo synchronisée depuis ' : 'Photo synced from '}<span className="text-[#F3F4F6]">CloseOS Business</span></p>
          )}
        </div>
      </div>

      {/* Onglets */}
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-[#3A4242] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setParams(t.id === 'profil' ? {} : { tab: t.id })}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.id ? 'border-[#CEFF8F] text-[#CEFF8F]' : 'border-transparent text-[#A1A9A9] hover:text-white'
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-[#A1A9A9]">
          <Loader2 className="h-4 w-4 animate-spin" /> {lang === 'fr' ? 'Chargement…' : 'Loading…'}
        </div>
      ) : tab === 'profil' ? (
        <form onSubmit={save} className="space-y-5">
          <p className="rounded-lg border border-[#3A4242] bg-[#222828] px-4 py-3 text-xs text-[#A1A9A9]">
            {lang === 'fr' ? (
              <>Ces informations préremplissent automatiquement <span className="text-[#A0E7EC]">vos champs (propriétaire)</span> dans les contrats — sauf la signature, la date et l’heure.</>
            ) : (
              <>This information automatically prefills <span className="text-[#A0E7EC]">your fields (owner)</span> in contracts — except the signature, date and time.</>
            )}
          </p>

          <Field icon={User} label={lang === 'fr' ? 'Nom complet' : 'Full name'} value={form.full_name} onChange={(v) => set('full_name', v)} placeholder="Thomas Shamoev" />

          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">
              {lang === 'fr' ? 'Email du compte' : 'Account email'} <span className="text-[#A1A9A9]/60">{lang === 'fr' ? '(non modifiable)' : '(not editable)'}</span>
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

          <Field icon={Briefcase} label={lang === 'fr' ? 'Entreprise / Dénomination' : 'Company / Legal name'} value={form.company} onChange={(v) => set('company', v)} placeholder="CloseOS SAS" />

          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">{lang === 'fr' ? 'Téléphone' : 'Phone'}</label>
            <PhoneInput value={form.phone} onChange={(v) => set('phone', v)} />
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">{lang === 'fr' ? 'Adresse complète' : 'Full address'}</label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
              <PlacesInput variant="dark" mode="address" value={form.address} onChange={(v) => set('address', v)} placeholder="12 rue de Paris, 75001 Paris" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field icon={FileDigit} label="SIRET" value={form.siret} onChange={(v) => set('siret', v)} placeholder={lang === 'fr' ? 'ex. 14 chiffres (FR)' : 'e.g. 14 digits (FR)'} />
            <Field icon={Hash} label="SIREN" value={form.siren} onChange={(v) => set('siren', v)} placeholder={lang === 'fr' ? 'ex. 9 chiffres (FR)' : 'e.g. 9 digits (FR)'} />
            <Field icon={Percent} label={lang === 'fr' ? 'N° de TVA' : 'VAT number'} value={form.tva} onChange={(v) => set('tva', v)} placeholder="ex. FR12345678901" />
            <Field icon={Landmark} label={lang === 'fr' ? "N° d'entreprise" : 'Company ID'} value={form.company_id} onChange={(v) => set('company_id', v)} placeholder={lang === 'fr' ? 'Registre national' : 'National registry'} />
            <Field icon={Tag} label={lang === 'fr' ? 'Code APE/NAF' : 'APE/NAF code'} value={form.ape} onChange={(v) => set('ape', v)} placeholder="ex. 6201Z" />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 rounded bg-[#CEFF8F] px-5 py-2.5 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC] disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {lang === 'fr' ? 'Enregistrer' : 'Save'}
            </button>
            {saved && <span className="text-sm text-[#CEFF8F]">{lang === 'fr' ? 'Profil enregistré ✓' : 'Profile saved ✓'}</span>}
          </div>
        </form>
      ) : (
        /* ─────────── Paramètres ─────────── */
        <div className="space-y-4">
          {/* Compte */}
          <SettingCard icon={UserRound} title={lang === 'fr' ? 'Compte' : 'Account'}>
            <div className="flex items-center justify-between border-b border-[#3A4242] py-2.5">
              <span className="text-sm text-[#A1A9A9]">Email</span>
              <span className="text-sm font-medium text-white">{account.email || form.email || '—'}</span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-sm text-[#A1A9A9]">{lang === 'fr' ? 'Membre depuis' : 'Member since'}</span>
              <span className="text-sm font-medium text-white">{fmtDate(account.createdAt, lang)}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[#A1A9A9]">
              {lang === 'fr' ? (
                <>Votre identifiant CloseOS est partagé entre <span className="text-[#F3F4F6]">Business</span> et <span className="text-[#CEFF8F]">Sign</span>.</>
              ) : (
                <>Your CloseOS login is shared between <span className="text-[#F3F4F6]">Business</span> and <span className="text-[#CEFF8F]">Sign</span>.</>
              )}
            </p>
          </SettingCard>

          {/* Abonnement */}
          <SettingCard icon={CreditCard} title={lang === 'fr' ? 'Abonnement' : 'Subscription'}>
            {sub?.exempt ? (
              <p className="text-sm leading-relaxed text-[#A1A9A9]">
                {lang === 'fr' ? (
                  <>CloseOS Sign est <span className="text-[#CEFF8F]">inclus</span> avec votre abonnement CloseOS Business — sans frais supplémentaires.</>
                ) : (
                  <>CloseOS Sign is <span className="text-[#CEFF8F]">included</span> with your CloseOS Business subscription — at no extra cost.</>
                )}
              </p>
            ) : sub && isSubActive(sub.status) ? (
              <>
                <div className="flex items-center justify-between border-b border-[#3A4242] py-2.5">
                  <span className="text-sm text-[#A1A9A9]">{lang === 'fr' ? 'Statut' : 'Status'}</span>
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#CEFF8F]">
                    <CheckCircle2 className="h-4 w-4" /> {sub.status === 'trialing' ? (lang === 'fr' ? 'Essai en cours' : 'Trial in progress') : (lang === 'fr' ? 'Actif' : 'Active')}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-[#A1A9A9]">{sub.status === 'trialing' ? (lang === 'fr' ? 'Fin de l’essai' : 'Trial ends') : (lang === 'fr' ? 'Renouvellement' : 'Renewal')}</span>
                  <span className="text-sm font-medium text-white">{fmtDate(sub.currentPeriodEnd, lang)}</span>
                </div>
                <button onClick={() => openSignBillingPortal()} className="mt-2 inline-flex items-center gap-2 rounded-lg border border-[#3A4242] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:border-[#CEFF8F]">
                  <ExternalLink className="h-4 w-4" /> {lang === 'fr' ? 'Gérer l’abonnement' : 'Manage subscription'}
                </button>
              </>
            ) : (
              <>
                <p className="mb-4 text-sm text-[#A1A9A9]">
                  {lang === 'fr' ? (
                    <>Activez CloseOS Sign — toutes les fonctionnalités, à partir de <span className="text-[#F3F4F6]">9 €/mois</span>. 14 jours d’essai gratuit.</>
                  ) : (
                    <>Activate CloseOS Sign — all features, from <span className="text-[#F3F4F6]">€9/month</span>. 14-day free trial.</>
                  )}
                </p>
                <button onClick={() => navigate('/sign/abonnement')} className="inline-flex items-center gap-2 rounded-lg bg-[#CEFF8F] px-4 py-2.5 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC]">
                  {lang === 'fr' ? 'S’abonner' : 'Subscribe'} <ArrowRight className="h-4 w-4" />
                </button>
              </>
            )}
          </SettingCard>

          {/* Mot de passe */}
          <SettingCard
            icon={Lock}
            title={authId?.hasPassword === false ? (lang === 'fr' ? 'Définir un mot de passe' : 'Set a password') : (lang === 'fr' ? 'Mot de passe' : 'Password')}
            desc={
              authId?.hasPassword === false
                ? (lang === 'fr'
                    ? 'Vous êtes connecté avec Google — votre compte n’a pas encore de mot de passe. Définissez-en un pour pouvoir aussi vous connecter par email.'
                    : 'You are signed in with Google — your account has no password yet. Set one so you can also sign in with your email.')
                : (lang === 'fr'
                    ? 'C’est le mot de passe de votre compte CloseOS (Business et Sign) — le modifier ici le change partout.'
                    : 'This is your CloseOS account password (Business and Sign) — changing it here changes it everywhere.')
            }
          >
            <form onSubmit={submitPassword} className="space-y-3">
              {authId?.hasPassword !== false && (
                <PwInput placeholder={lang === 'fr' ? 'Mot de passe actuel' : 'Current password'} autoComplete="current-password" value={pw.current} onChange={(v) => { setPw((p) => ({ ...p, current: v })); setPwMsg(null); }} />
              )}
              <PwInput placeholder={lang === 'fr' ? 'Nouveau mot de passe' : 'New password'} autoComplete="new-password" value={pw.next} onChange={(v) => { setPw((p) => ({ ...p, next: v })); setPwMsg(null); }} />
              <PwInput placeholder={lang === 'fr' ? 'Confirmer le nouveau mot de passe' : 'Confirm new password'} autoComplete="new-password" value={pw.confirm} onChange={(v) => { setPw((p) => ({ ...p, confirm: v })); setPwMsg(null); }} />
              {pwMsg && (
                <div className={`flex items-center gap-2 rounded border px-3 py-2 text-xs ${pwMsg.type === 'ok' ? 'border-[#CEFF8F]/30 bg-[#CEFF8F]/10 text-[#CEFF8F]' : 'border-[#ef6b6b]/30 bg-[#ef6b6b]/10 text-[#ef6b6b]'}`}>
                  {pwMsg.type === 'ok' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />} {pwMsg.text}
                </div>
              )}
              <button
                type="submit"
                disabled={pwBusy || !pw.next || !pw.confirm || (authId?.hasPassword !== false && !pw.current)}
                className="inline-flex items-center gap-2 rounded bg-[#CEFF8F] px-4 py-2.5 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC] disabled:opacity-50"
              >
                {pwBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} {authId?.hasPassword === false ? (lang === 'fr' ? 'Définir le mot de passe' : 'Set password') : (lang === 'fr' ? 'Mettre à jour le mot de passe' : 'Update password')}
              </button>
            </form>
          </SettingCard>

          {/* Associer Google — connexion rapide en un clic */}
          {authId?.google === false && (
            <SettingCard
              icon={ShieldCheck}
              title={lang === 'fr' ? 'Se connecter avec Google' : 'Sign in with Google'}
              desc={lang === 'fr'
                ? 'Associez votre compte Google pour vous connecter plus vite, en un clic — en plus de votre email et mot de passe.'
                : 'Link your Google account to sign in faster, in one click — in addition to your email and password.'}
            >
              <button
                type="button"
                onClick={linkGoogleSign}
                className="inline-flex items-center gap-2.5 rounded-xl border border-[#3A4242] bg-white px-4 py-2.5 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#F3F4F6]"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
                </svg>
                {lang === 'fr' ? 'Associer mon compte Google' : 'Link my Google account'}
              </button>
            </SettingCard>
          )}

          {/* Appareils de confiance */}
          <SettingCard
            icon={Smartphone}
            title={lang === 'fr' ? 'Appareils de confiance' : 'Trusted devices'}
            desc={lang === 'fr'
              ? 'Appareils où la vérification (code email) a réussi. Chacun reste de confiance 7 jours, puis une nouvelle vérification est demandée.'
              : 'Devices where verification (email code) succeeded. Each stays trusted for 7 days, then a new verification is required.'}
          >
            {devices === null ? (
              <div className="flex items-center gap-2 text-sm text-[#A1A9A9]"><Loader2 className="h-4 w-4 animate-spin" /> {lang === 'fr' ? 'Chargement…' : 'Loading…'}</div>
            ) : devices.length === 0 ? (
              <p className="text-sm text-[#A1A9A9]">{lang === 'fr' ? 'Aucun appareil de confiance actif.' : 'No active trusted devices.'}</p>
            ) : (
              <div className="space-y-2">
                {devices.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#3A4242] bg-[#191E1E] px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-white">
                        <Smartphone className="h-4 w-4 shrink-0 text-[#A1A9A9]" />
                        {d.device_name || (lang === 'fr' ? 'Appareil' : 'Device')}
                        {d.current && <span className="rounded-full bg-[#CEFF8F]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#CEFF8F]">{lang === 'fr' ? 'Cet appareil' : 'This device'}</span>}
                      </div>
                      <div className="mt-1 truncate text-xs text-[#A1A9A9]">
                        {[d.location, d.last_ip].filter(Boolean).join(' · ') || (lang === 'fr' ? 'Localisation inconnue' : 'Unknown location')} {lang === 'fr' ? '— ajouté le' : '— added on'} {fmtDate(d.created_at, lang)}
                      </div>
                    </div>
                    <button
                      onClick={() => revokeOne(d.id)}
                      disabled={deviceBusy === d.id}
                      className="shrink-0 rounded-lg border border-[#3A4242] px-3 py-1.5 text-xs font-medium text-[#A1A9A9] transition-colors hover:border-[#ef6b6b]/40 hover:text-[#ef6b6b] disabled:opacity-50"
                    >
                      {deviceBusy === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (lang === 'fr' ? 'Révoquer' : 'Revoke')}
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
                <div className="text-sm font-medium text-white">{lang === 'fr' ? 'Connexion sur un nouvel appareil' : 'Sign-in on a new device'}</div>
                <div className="text-xs text-[#A1A9A9]">{lang === 'fr' ? 'Recevez un email de sécurité à chaque connexion vérifiée sur un nouvel appareil.' : 'Receive a security email for each verified sign-in on a new device.'}</div>
              </div>
              <Toggle checked={notif?.new_device ?? true} disabled={!notif} onChange={(v) => toggleNotif('new_device', v)} />
            </div>
          </SettingCard>

          {/* Connecteur MCP (IA) */}
          <SettingCard
            icon={Plug}
            title={lang === 'fr' ? 'Connecteur MCP (IA)' : 'MCP connector (AI)'}
            desc={lang === 'fr'
              ? 'Pilote CloseOS Sign depuis un assistant IA (Claude, etc.) : créer des contrats, poser des champs, assigner des modèles à ton équipe, suivre les signatures. Le lien contient une clé secrète propre à ton compte.'
              : 'Drive CloseOS Sign from an AI assistant (Claude, etc.): create contracts, place fields, assign templates to your team, track signatures. The link contains a secret key unique to your account.'}
          >
            {!mcpLoaded ? (
              <div className="flex items-center gap-2 text-sm text-[#A1A9A9]"><Loader2 className="h-4 w-4 animate-spin" /> …</div>
            ) : mcpKey ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-lg border border-[#3A4242] bg-[#191E1E] px-3 py-2.5">
                  <code className="min-w-0 flex-1 truncate text-xs text-[#A0E7EC]">{mcpConnectorUrl(mcpKey)}</code>
                  <button onClick={copyMcp} title={lang === 'fr' ? 'Copier' : 'Copy'} className="shrink-0 rounded p-1.5 text-[#A1A9A9] transition-colors hover:bg-[#3A4242] hover:text-white">
                    {mcpCopied ? <Check className="h-4 w-4 text-[#CEFF8F]" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-[#A1A9A9]">
                  {lang === 'fr'
                    ? 'Ajoute ce lien comme « connecteur personnalisé » dans ton assistant IA. Garde-le secret : quiconque le possède peut piloter ton compte Sign.'
                    : 'Add this link as a “custom connector” in your AI assistant. Keep it secret: anyone who has it can drive your Sign account.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={genMcp} disabled={mcpBusy} className="inline-flex items-center gap-2 rounded-lg border border-[#3A4242] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:border-[#CEFF8F] disabled:opacity-50">
                    {mcpBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {lang === 'fr' ? 'Régénérer la clé' : 'Regenerate key'}
                  </button>
                  <button onClick={revokeMcp} disabled={mcpBusy} className="inline-flex items-center gap-2 rounded-lg border border-[#3A4242] px-4 py-2.5 text-sm font-medium text-[#ef6b6b] transition-colors hover:border-[#ef6b6b] disabled:opacity-50">
                    <Power className="h-4 w-4" /> {lang === 'fr' ? 'Désactiver' : 'Disable'}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={genMcp} disabled={mcpBusy} className="inline-flex items-center gap-2 rounded-lg bg-[#CEFF8F] px-4 py-2.5 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC] disabled:opacity-50">
                {mcpBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />} {lang === 'fr' ? 'Activer le connecteur' : 'Enable connector'}
              </button>
            )}
          </SettingCard>

          {/* Paiement Stripe */}
          <SettingCard
            icon={CreditCard}
            title={lang === 'fr' ? 'Paiement Stripe' : 'Stripe payment'}
            desc={lang === 'fr'
              ? 'Connecte ton compte Stripe pour proposer « Payé + signé » : le signataire paie pour valider, l’argent arrive directement sur ton compte.'
              : 'Connect your Stripe account to offer “Paid + signed”: the signer pays to confirm, and the money lands directly in your account.'}
          >
            {stripeConnected ? (
              <div className="flex items-center gap-2 rounded-lg border border-[#CEFF8F]/30 bg-[#CEFF8F]/10 px-3 py-2.5 text-sm font-medium text-[#CEFF8F]">
                <CheckCircle2 className="h-4 w-4" /> {lang === 'fr' ? 'Compte Stripe connecté' : 'Stripe account connected'}
              </div>
            ) : (
              <button
                onClick={connectStripe}
                disabled={stripeBusy}
                className="inline-flex items-center gap-2 rounded-lg bg-[#CEFF8F] px-4 py-2.5 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC] disabled:opacity-50"
              >
                {stripeBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />} {lang === 'fr' ? 'Connecter mon compte Stripe' : 'Connect my Stripe account'}
              </button>
            )}
          </SettingCard>

          {/* Données & confidentialité */}
          <SettingCard
            icon={ShieldCheck}
            title={lang === 'fr' ? 'Données & confidentialité' : 'Data & privacy'}
            desc={lang === 'fr'
              ? 'Signature électronique conforme RGPD. Chaque signature génère un faisceau de preuves (horodatage, ouvertures du lien, appareil) conservé avec le contrat.'
              : 'GDPR-compliant electronic signature. Each signature generates an evidence bundle (timestamp, link opens, device) kept with the contract.'}
          >
            <button
              onClick={exportData}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-lg border border-[#3A4242] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:border-[#CEFF8F] disabled:opacity-50"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {lang === 'fr' ? 'Télécharger mes données (JSON)' : 'Download my data (JSON)'}
            </button>
            <p className="mt-3 text-xs text-[#A1A9A9]">{lang === 'fr' ? 'Export de votre profil, vos contrats et vos contacts.' : 'Export of your profile, contracts and contacts.'}</p>
          </SettingCard>

          {/* Sessions */}
          <SettingCard icon={Power} title="Sessions">
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 rounded-lg border border-[#3A4242] px-4 py-2.5 text-sm font-medium text-[#A1A9A9] transition-colors hover:border-[#A1A9A9] hover:text-white"
              >
                <LogOut className="h-4 w-4" /> {lang === 'fr' ? 'Se déconnecter' : 'Log out'}
              </button>
              <button
                onClick={signOutEverywhere}
                disabled={outAllBusy}
                className="flex items-center justify-center gap-2 rounded-lg border border-[#ef6b6b]/30 px-4 py-2.5 text-sm font-medium text-[#ef6b6b] transition-colors hover:bg-[#ef6b6b]/10 disabled:opacity-50"
              >
                {outAllBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} {lang === 'fr' ? 'Déconnexion de tous les appareils' : 'Log out of all devices'}
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
