import { useState, useRef, useEffect } from 'react';
import { ArrowRight, Loader2, Building2, Briefcase, ChevronRight, Camera, User, X, Check, ZoomIn, ZoomOut, Search, Calendar } from 'lucide-react';
import { useBusinessAuth } from '../contexts/BusinessAuthContext';
import { countries } from '../../lib/countries';
import { PhoneInput } from './PhoneInput';
import { supabase } from '../../lib/supabase';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../../lib/image-crop';

const NICHES = [
  'Coaching',
  'Consulting',
  'Formation',
  'Agence',
  'SaaS',
  'E-commerce',
  'Immobilier',
  'Autre',
];

const TEAM_SIZES = [
  '1 (Solo)',
  '2-5',
  '6-10',
  '11-25',
  '25+',
];

function calculateAge(dateString: string): number | null {
  if (!dateString) return null;
  const birth = new Date(dateString);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function getDeviceFingerprint(): string {
  const key = 'closeos_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID() + '-' + navigator.userAgent.slice(0, 50).replace(/\s/g, '_');
    localStorage.setItem(key, id);
  }
  return id;
}

async function registerDeviceAfterOnboarding(userId: string) {
  try {
    const fingerprint = getDeviceFingerprint();
    const token = crypto.randomUUID();
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);

    // Remove any existing token for this device
    await supabase
      .from('business_device_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('device_fingerprint', fingerprint);

    // Insert new device token
    await supabase
      .from('business_device_tokens')
      .insert({
        user_id: userId,
        device_fingerprint: fingerprint,
        token,
        expires_at: expires.toISOString(),
      });

    localStorage.setItem('closeos_device_token', token);
  } catch {
    // Non-blocking — worst case user will see A2F on next login
  }
}

export function BusinessOnboardingModal() {
  const { user, businessProfile, businessSettings, hasOnboarded, loading: authLoading, updateBusinessProfile, updateBusinessSettings, isTeamMember, teamMember, refreshProfile, setNeedsVerification } = useBusinessAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Avatar crop states
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [avatarUrl, setAvatarUrl] = useState(businessProfile?.avatar_url || user?.user_metadata?.avatar_url || '');

  // Step 1: Profile
  const [fullName, setFullName] = useState(businessProfile?.full_name || user?.user_metadata?.full_name || '');
  const [countryCode, setCountryCode] = useState('+33');
  const [countrySearch, setCountrySearch] = useState('');
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const [phone, setPhone] = useState(businessProfile?.phone || '');
  const [role, setRole] = useState(businessProfile?.role || '');

  // Step 2: Company
  const [companyName, setCompanyName] = useState('');
  const [teamSize, setTeamSize] = useState('');
  const [niche, setNiche] = useState('');
  const [nicheCustom, setNicheCustom] = useState('');

  // Close country dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target as Node)) {
        setIsCountryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Team member profile fields
  const [tmFirstName, setTmFirstName] = useState(teamMember?.first_name || '');
  const [tmLastName, setTmLastName] = useState(teamMember?.last_name || '');
  const [tmDob, setTmDob] = useState(teamMember?.date_of_birth || '');
  const [tmPhone, setTmPhone] = useState(teamMember?.phone || '');
  const [tmAvatarUrl, setTmAvatarUrl] = useState(teamMember?.avatar_url || user?.user_metadata?.avatar_url || '');
  const [tmCountryCode, setTmCountryCode] = useState('+33');
  const [tmCountrySearch, setTmCountrySearch] = useState('');
  const [isTmCountryOpen, setIsTmCountryOpen] = useState(false);
  const tmCountryRef = useRef<HTMLDivElement>(null);
  const tmFileInputRef = useRef<HTMLInputElement>(null);

  // Close team member country dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (tmCountryRef.current && !tmCountryRef.current.contains(e.target as Node)) {
        setIsTmCountryOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Shared crop callback — must be declared before any early return that uses it
  const onCropComplete = (_: any, pixels: any) => setCroppedAreaPixels(pixels);

  // Don't show if already onboarded, no user, or still loading
  if (!user || hasOnboarded || authLoading) return null;

  // ─── Team Member Profile Onboarding ───
  if (isTeamMember && teamMember) {
    const settings = businessSettings || {};
    const tmAge = calculateAge(tmDob);
    const tmInitials = [tmFirstName, tmLastName].filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);

    const tmSelectedCountry = countries.find(c => c.dial_code === tmCountryCode);
    const tmFilteredCountries = tmCountrySearch
      ? countries.filter(c =>
          c.name.toLowerCase().includes(tmCountrySearch.toLowerCase()) ||
          c.dial_code.includes(tmCountrySearch) ||
          c.code.toLowerCase().includes(tmCountrySearch.toLowerCase())
        )
      : countries;

    const handleTmAvatarClick = () => tmFileInputRef.current?.click();

    const onTmFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        const reader = new FileReader();
        reader.addEventListener('load', () => setImageSrc(reader.result as string));
        reader.readAsDataURL(e.target.files[0]);
        e.target.value = '';
      }
    };

    const saveTmCroppedImage = async () => {
      try {
        setUploading(true);
        const blob = await getCroppedImg(imageSrc!, croppedAreaPixels);
        if (!blob) throw new Error("Erreur image");
        const fileName = `team-${teamMember.id}-${Math.random()}.jpg`;
        const file = new File([blob], fileName, { type: 'image/jpeg' });
        const { error } = await supabase.storage.from('avatars').upload(fileName, file);
        if (error) throw error;
        const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
        setTmAvatarUrl(data.publicUrl);
        setImageSrc(null);
      } catch (e) {
        console.error('Avatar upload error:', e);
      } finally {
        setUploading(false);
      }
    };

    const handleTmSubmit = async () => {
      if (!tmFirstName || !tmLastName) return;
      setLoading(true);
      try {
        const { error } = await supabase
          .from('business_team_members')
          .update({
            first_name: tmFirstName,
            last_name: tmLastName,
            date_of_birth: tmDob || null,
            phone: tmPhone || null,
            avatar_url: tmAvatarUrl || null,
            has_onboarded: true,
          })
          .eq('id', teamMember.id);
        if (error) throw error;

        // Auto-register device after onboarding to skip A2F on first session
        if (user?.id) {
          await registerDeviceAfterOnboarding(user.id);
          setNeedsVerification(false);
        }

        await refreshProfile();
      } catch (err) {
        console.error('Team member onboarding error:', err);
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-md p-4 overflow-y-auto">
        {/* Crop overlay */}
        {imageSrc && (
          <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-lg h-[400px] relative rounded-xl overflow-hidden border border-stone-700/30 bg-stone-900 mb-6">
              <Cropper image={imageSrc} crop={crop} zoom={zoom} aspect={1} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} />
            </div>
            <div className="w-full max-w-lg space-y-6">
              <div className="flex items-center gap-4 px-4">
                <ZoomOut className="h-5 w-5 text-stone-400" />
                <input type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e) => setZoom(Number(e.target.value))} className="w-full h-2 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-stone-400" />
                <ZoomIn className="h-5 w-5 text-stone-400" />
              </div>
              <div className="flex gap-4 justify-center">
                <button onClick={() => { setImageSrc(null); setZoom(1); }} disabled={uploading} className="px-6 py-3 rounded-full border border-stone-700 text-stone-300 font-bold hover:bg-stone-800 transition-colors flex items-center gap-2">
                  <X className="h-4 w-4" /> Annuler
                </button>
                <button onClick={saveTmCroppedImage} disabled={uploading} className="px-6 py-3 rounded-full bg-stone-900 text-white font-bold hover:bg-stone-800 transition-colors shadow-lg flex items-center gap-2 active:scale-95">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Valider la photo
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="w-full max-w-lg rounded-xl border border-stone-200/20 dark:border-neutral-700 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl p-8 shadow-[0_20px_40px_rgba(27,28,27,0.04)] animate-in zoom-in-95 duration-200">
          {/* Header with org info */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg overflow-hidden border border-stone-200/20 shrink-0">
              {settings.logo_url ? (
                <img src={settings.logo_url} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-stone-900 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-white" />
                </div>
              )}
            </div>
            <div>
              <h2 className="text-xl font-['Manrope'] font-extrabold tracking-tight text-stone-900 dark:text-white">Bienvenue chez {settings.company_name || 'votre organisation'} !</h2>
              <p className="text-stone-500 dark:text-neutral-400 text-sm">Complétez votre profil pour commencer</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Avatar */}
            <div className="flex justify-center mb-2">
              <div className="relative group cursor-pointer" onClick={handleTmAvatarClick}>
                <div className="w-20 h-20 rounded-full border-2 border-stone-200/20 dark:border-neutral-700 overflow-hidden bg-stone-100/50 dark:bg-neutral-800 flex items-center justify-center transition-all group-hover:border-stone-400">
                  {tmAvatarUrl ? (
                    <img src={tmAvatarUrl} alt="Profil" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-stone-500">
                      {tmInitials || <User className="w-8 h-8 text-stone-400" />}
                    </span>
                  )}
                </div>
                <div className="absolute bottom-0 right-0 bg-stone-900 p-1.5 rounded-full border-2 border-white text-white shadow-sm group-hover:scale-110 transition-transform">
                  <Camera className="w-3.5 h-3.5" />
                </div>
                <input type="file" ref={tmFileInputRef} onChange={onTmFileChange} accept="image/*" className="hidden" />
              </div>
            </div>

            {/* Prénom + Nom */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[0.75rem] font-semibold uppercase tracking-widest text-stone-500 dark:text-neutral-400">Prénom</label>
                <input
                  type="text"
                  value={tmFirstName}
                  onChange={(e) => setTmFirstName(e.target.value)}
                  className="w-full rounded-xl bg-stone-100/50 dark:bg-neutral-800 border-none py-3 px-4 text-stone-900 dark:text-white focus:ring-2 focus:ring-emerald-600/20 focus:outline-none"
                  placeholder="Jean"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[0.75rem] font-semibold uppercase tracking-widest text-stone-500 dark:text-neutral-400">Nom</label>
                <input
                  type="text"
                  value={tmLastName}
                  onChange={(e) => setTmLastName(e.target.value)}
                  className="w-full rounded-xl bg-stone-100/50 dark:bg-neutral-800 border-none py-3 px-4 text-stone-900 dark:text-white focus:ring-2 focus:ring-emerald-600/20 focus:outline-none"
                  placeholder="Dupont"
                  required
                />
              </div>
            </div>

            {/* Date de naissance */}
            <div>
              <label className="mb-1.5 block text-[0.75rem] font-semibold uppercase tracking-widest text-stone-500 dark:text-neutral-400">Date de naissance</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none" />
                <input
                  type="date"
                  value={tmDob}
                  onChange={(e) => setTmDob(e.target.value)}
                  className="w-full rounded-xl bg-stone-100/50 border-none py-3 pl-11 pr-4 text-stone-900 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none"
                />
              </div>
              {tmAge !== null && tmAge >= 0 && (
                <p className="text-xs text-stone-500 mt-1.5">{tmAge} ans</p>
              )}
            </div>

            {/* Téléphone */}
            <div>
              <label className="mb-1.5 block text-[0.75rem] font-semibold uppercase tracking-widest text-stone-500 dark:text-neutral-400">Téléphone</label>
              <PhoneInput
                value={tmPhone}
                onChange={setTmPhone}
                className="!bg-stone-100/50 dark:!bg-neutral-800"
              />
            </div>

            <button
              onClick={handleTmSubmit}
              disabled={loading || !tmFirstName || !tmLastName}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 py-3.5 font-bold text-white transition-all hover:bg-stone-800 shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                <>
                  Terminer
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const selectedCountry = countries.find(c => c.dial_code === countryCode);

  const filteredCountries = countrySearch
    ? countries.filter(c =>
        c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
        c.dial_code.includes(countrySearch) ||
        c.code.toLowerCase().includes(countrySearch.toLowerCase())
      )
    : countries;

  // Avatar handlers
  const handleAvatarClick = () => fileInputRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => setImageSrc(reader.result as string));
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const showCroppedImage = async () => {
    try {
      setUploading(true);
      const croppedImageBlob = await getCroppedImg(imageSrc!, croppedAreaPixels);
      if (!croppedImageBlob) throw new Error("Erreur lors de la création de l'image.");

      const fileName = `business-${user.id}-${Math.random()}.jpg`;
      const file = new File([croppedImageBlob], fileName, { type: 'image/jpeg' });

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      setAvatarUrl(urlData.publicUrl);
      setImageSrc(null);
    } catch (e) {
      console.error('Avatar upload error:', e);
    } finally {
      setUploading(false);
    }
  };

  const handleStep1 = async () => {
    if (!fullName || !role) return;
    setStep(2);
  };

  const handleStep2 = async () => {
    if (!companyName || !teamSize || !niche) return;
    setLoading(true);

    try {
      await updateBusinessProfile({
        full_name: fullName,
        phone: phone || '',
        role,
        avatar_url: avatarUrl || null,
        has_onboarded: true,
      });

      await updateBusinessSettings({
        company_name: companyName,
        team_size: teamSize,
        niche,
        niche_custom: niche === 'Autre' ? nicheCustom : null,
      });

      // Auto-register device after onboarding to skip A2F on first session
      if (user?.id) {
        await registerDeviceAfterOnboarding(user.id);
        setNeedsVerification(false);
      }
    } catch (err) {
      console.error('Onboarding error:', err);
    } finally {
      setLoading(false);
    }
  };

  const initials = fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-md p-4 overflow-y-auto">
      {/* Crop overlay */}
      {imageSrc && (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-lg h-[400px] relative rounded-xl overflow-hidden border border-stone-700/30 bg-stone-900 mb-6">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
          </div>
          <div className="w-full max-w-lg space-y-6">
            <div className="flex items-center gap-4 px-4">
              <ZoomOut className="h-5 w-5 text-stone-400" />
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full h-2 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-stone-400"
              />
              <ZoomIn className="h-5 w-5 text-stone-400" />
            </div>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => { setImageSrc(null); setZoom(1); }}
                disabled={uploading}
                className="px-6 py-3 rounded-full border border-stone-700 text-stone-300 font-bold hover:bg-stone-800 transition-colors flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Annuler
              </button>
              <button
                onClick={showCroppedImage}
                disabled={uploading}
                className="px-6 py-3 rounded-full bg-stone-900 text-white font-bold hover:bg-stone-800 transition-colors shadow-lg flex items-center gap-2 active:scale-95"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Valider la photo
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-lg rounded-xl border border-stone-200/20 dark:border-neutral-700 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl p-8 shadow-[0_20px_40px_rgba(27,28,27,0.04)] animate-in zoom-in-95 duration-200">
        {/* Progress indicator */}
        <div className="flex items-center gap-2 mb-8">
          <div className={`h-1.5 flex-1 rounded-full ${step >= 1 ? 'bg-emerald-500' : 'bg-stone-200'}`} />
          <div className={`h-1.5 flex-1 rounded-full ${step >= 2 ? 'bg-emerald-500' : 'bg-stone-200'}`} />
        </div>

        {step === 1 && (
          <>
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-stone-100/50 dark:bg-neutral-800">
                  <Briefcase className="h-5 w-5 text-stone-900 dark:text-white" />
                </div>
                <h2 className="text-xl font-['Manrope'] font-extrabold tracking-tight text-stone-900 dark:text-white">Votre profil</h2>
              </div>
              <p className="text-stone-500 dark:text-neutral-400 text-sm">Présentez-vous en quelques secondes</p>
            </div>

            <div className="space-y-4">
              {/* Avatar */}
              <div className="flex justify-center mb-2">
                <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
                  <div className="w-20 h-20 rounded-full border-2 border-stone-200/20 dark:border-neutral-700 overflow-hidden bg-stone-100/50 dark:bg-neutral-800 flex items-center justify-center transition-all group-hover:border-stone-400">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Profil" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-bold text-stone-500">
                        {initials || <User className="w-8 h-8 text-stone-400" />}
                      </span>
                    )}
                  </div>
                  <div className="absolute bottom-0 right-0 bg-stone-900 p-1.5 rounded-full border-2 border-white text-white shadow-sm group-hover:scale-110 transition-transform">
                    <Camera className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={onFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[0.75rem] font-semibold uppercase tracking-widest text-stone-500 dark:text-neutral-400">Nom complet</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl bg-stone-100/50 dark:bg-neutral-800 border-none py-3 px-4 text-stone-900 dark:text-white focus:ring-2 focus:ring-emerald-600/20 focus:outline-none"
                  placeholder="John Doe"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[0.75rem] font-semibold uppercase tracking-widest text-stone-500 dark:text-neutral-400">Téléphone</label>
                <PhoneInput
                  value={phone}
                  onChange={setPhone}
                  className="!bg-stone-100/50 dark:!bg-neutral-800"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[0.75rem] font-semibold uppercase tracking-widest text-stone-500 dark:text-neutral-400">Votre rôle</label>
                <div className="grid grid-cols-2 gap-2">
                  {['CEO / Fondateur', 'Sales Manager', 'Business Developer', 'Autre'].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`rounded-full border py-2.5 px-3 text-sm font-medium transition-all ${
                        role === r
                          ? 'border-stone-900 bg-stone-900 text-white'
                          : 'border-stone-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-stone-700 dark:text-neutral-200 hover:bg-stone-50 dark:hover:bg-neutral-700'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleStep1}
                disabled={!fullName || !role}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 py-3.5 font-bold text-white transition-all hover:bg-stone-800 shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
              >
                Continuer
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-stone-100/50 dark:bg-neutral-800">
                  <Building2 className="h-5 w-5 text-stone-900 dark:text-white" />
                </div>
                <h2 className="text-xl font-['Manrope'] font-extrabold tracking-tight text-stone-900 dark:text-white">Votre entreprise</h2>
              </div>
              <p className="text-stone-500 dark:text-neutral-400 text-sm">Configurez votre espace Business</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[0.75rem] font-semibold uppercase tracking-widest text-stone-500 dark:text-neutral-400">Nom de l'entreprise</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full rounded-xl bg-stone-100/50 dark:bg-neutral-800 border-none py-3 px-4 text-stone-900 dark:text-white focus:ring-2 focus:ring-emerald-600/20 focus:outline-none"
                  placeholder="Mon entreprise"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[0.75rem] font-semibold uppercase tracking-widest text-stone-500 dark:text-neutral-400">Taille de l'équipe</label>
                <div className="flex flex-wrap gap-2">
                  {TEAM_SIZES.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setTeamSize(size)}
                      className={`rounded-full border py-2 px-4 text-sm font-medium transition-all ${
                        teamSize === size
                          ? 'border-stone-900 bg-stone-900 text-white'
                          : 'border-stone-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-stone-700 dark:text-neutral-200 hover:bg-stone-50 dark:hover:bg-neutral-700'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[0.75rem] font-semibold uppercase tracking-widest text-stone-500 dark:text-neutral-400">Niche / Secteur</label>
                <div className="grid grid-cols-2 gap-2">
                  {NICHES.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNiche(n)}
                      className={`rounded-full border py-2 px-3 text-sm font-medium transition-all ${
                        niche === n
                          ? 'border-stone-900 bg-stone-900 text-white'
                          : 'border-stone-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-stone-700 dark:text-neutral-200 hover:bg-stone-50 dark:hover:bg-neutral-700'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                {niche === 'Autre' && (
                  <input
                    type="text"
                    value={nicheCustom}
                    onChange={(e) => setNicheCustom(e.target.value)}
                    className="mt-2 w-full rounded-xl bg-stone-100/50 dark:bg-neutral-800 border-none py-3 px-4 text-stone-900 dark:text-white focus:ring-2 focus:ring-emerald-600/20 focus:outline-none"
                    placeholder="Précisez votre secteur..."
                  />
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 rounded-full border border-stone-300 dark:border-neutral-600 py-3 font-medium text-stone-700 dark:text-neutral-200 hover:bg-stone-50 dark:hover:bg-neutral-800 transition-all"
                >
                  Retour
                </button>
                <button
                  onClick={handleStep2}
                  disabled={loading || !companyName || !teamSize || !niche}
                  className="flex-1 flex items-center justify-center gap-2 rounded-full bg-stone-900 py-3 font-bold text-white transition-all hover:bg-stone-800 shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                    <>
                      Terminer
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
