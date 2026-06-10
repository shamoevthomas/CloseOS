import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { User, Mail, Phone, MapPin, FileDigit, Hash, Percent, Landmark, Tag, Briefcase, Loader2, CheckCircle2, Settings, UserRound, LogOut, ShieldCheck, CreditCard, ExternalLink } from 'lucide-react';
import { getOwnerProfile, updateOwnerProfile, getOwnerStripeStatus, type OwnerProfile } from '../lib/signContracts';
import { signSupabase as supabase } from '../lib/signSupabase';
import { signOutSign, useSignOwner } from '../lib/signAuth';
import PhoneInput from '../components/PhoneInput';
import PlacesInput from '../components/PlacesInput';

/**
 * CloseOS Sign — Profil du propriétaire (compte sign_users) + Paramètres.
 * Les champs renseignés ici préremplissent automatiquement les champs PROPRIÉTAIRE
 * dans les contrats (signature exclue).
 */
const EMPTY: OwnerProfile = { full_name: '', email: '', phone: '', company: '', address: '', city: '', siret: '', siren: '', tva: '', company_id: '', ape: '' };

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

  useEffect(() => {
    document.title = 'Mon profil | CloseOS Sign';
    getOwnerProfile()
      .then((p) => setForm({ ...EMPTY, ...p }))
      .catch((e) => console.error('[sign] profil', e))
      .finally(() => setLoading(false));
    // Au retour de l'onboarding Stripe (?stripe_connected=1) → vérifie + persiste auprès de Stripe ; sinon lecture rapide.
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
        /* Paramètres */
        <div className="space-y-4">
          <div className="rounded-xl border border-[#3A4242] bg-[#222828] p-5">
            <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">Compte</div>
            <div className="flex items-center justify-between border-b border-[#3A4242] py-3">
              <span className="text-sm text-[#A1A9A9]">Identifiant</span>
              <span className="text-sm font-medium text-white">{user}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-[#A1A9A9]">Email</span>
              <span className="text-sm font-medium text-white">{form.email || '—'}</span>
            </div>
          </div>

          <div className="rounded-xl border border-[#3A4242] bg-[#222828] p-5">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#CEFF8F]" /> Sécurité & conformité
            </div>
            <p className="text-sm leading-relaxed text-[#A1A9A9]">
              Signature électronique conforme RGPD. Chaque signature génère un faisceau de preuves (horodatage, ouvertures du lien,
              appareil) conservé avec le contrat.
            </p>
          </div>

          {/* Paiement Stripe (« Payé + signé ») */}
          <div className="rounded-xl border border-[#3A4242] bg-[#222828] p-5">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">
              <CreditCard className="h-3.5 w-3.5 text-[#CEFF8F]" /> Paiement Stripe
            </div>
            <p className="mb-4 text-sm leading-relaxed text-[#A1A9A9]">
              Connecte ton compte Stripe pour proposer « Payé + signé » : le signataire paie pour valider, l’argent arrive directement sur ton compte.
            </p>
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
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-xl border border-[#3A4242] bg-[#222828] px-5 py-3 text-sm font-medium text-[#A1A9A9] transition-colors hover:border-red-500/40 hover:text-red-400"
          >
            <LogOut className="h-4 w-4" /> Se déconnecter
          </button>
        </div>
      )}
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
