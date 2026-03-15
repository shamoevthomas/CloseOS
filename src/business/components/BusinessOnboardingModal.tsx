import { useState, useRef, useEffect } from 'react';
import { ArrowRight, Loader2, Building2, Briefcase, ChevronRight, Camera, User, X, Check, ZoomIn, ZoomOut, Search, Calendar } from 'lucide-react';
import { useBusinessAuth } from '../contexts/BusinessAuthContext';
import { countries } from '../../lib/countries';
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

export function BusinessOnboardingModal() {
  const { user, businessProfile, businessSettings, hasOnboarded, loading: authLoading, updateBusinessProfile, updateBusinessSettings, isTeamMember, teamMember, refreshProfile } = useBusinessAuth();
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
            phone: tmPhone ? `${tmCountryCode} ${tmPhone}` : null,
            avatar_url: tmAvatarUrl || null,
            has_onboarded: true,
          })
          .eq('id', teamMember.id);
        if (error) throw error;
        refreshProfile();
      } catch (err) {
        console.error('Team member onboarding error:', err);
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
        {/* Crop overlay */}
        {imageSrc && (
          <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-lg h-[400px] relative rounded-xl overflow-hidden border border-amber-700/30 bg-slate-900 mb-6">
              <Cropper image={imageSrc} crop={crop} zoom={zoom} aspect={1} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} />
            </div>
            <div className="w-full max-w-lg space-y-6">
              <div className="flex items-center gap-4 px-4">
                <ZoomOut className="h-5 w-5 text-slate-400" />
                <input type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e) => setZoom(Number(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500" />
                <ZoomIn className="h-5 w-5 text-slate-400" />
              </div>
              <div className="flex gap-4 justify-center">
                <button onClick={() => { setImageSrc(null); setZoom(1); }} disabled={uploading} className="px-6 py-3 rounded-xl border border-slate-700 text-slate-300 font-bold hover:bg-slate-800 transition-colors flex items-center gap-2">
                  <X className="h-4 w-4" /> Annuler
                </button>
                <button onClick={saveTmCroppedImage} disabled={uploading} className="px-6 py-3 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-500 transition-colors shadow-lg flex items-center gap-2">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Valider la photo
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-200">
          {/* Header with org info */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shrink-0">
              {settings.logo_url ? (
                <img src={settings.logo_url} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-white" />
                </div>
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Bienvenue chez {settings.company_name || 'votre organisation'} !</h2>
              <p className="text-slate-500 text-sm">Complétez votre profil pour commencer</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Avatar */}
            <div className="flex justify-center mb-2">
              <div className="relative group cursor-pointer" onClick={handleTmAvatarClick}>
                <div className="w-20 h-20 rounded-full border-2 border-amber-200 overflow-hidden bg-amber-50 flex items-center justify-center transition-all group-hover:border-amber-500">
                  {tmAvatarUrl ? (
                    <img src={tmAvatarUrl} alt="Profil" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-amber-600">
                      {tmInitials || <User className="w-8 h-8 text-amber-400" />}
                    </span>
                  )}
                </div>
                <div className="absolute bottom-0 right-0 bg-amber-600 p-1.5 rounded-full border-2 border-white text-white shadow-sm group-hover:scale-110 transition-transform">
                  <Camera className="w-3.5 h-3.5" />
                </div>
                <input type="file" ref={tmFileInputRef} onChange={onTmFileChange} accept="image/*" className="hidden" />
              </div>
            </div>

            {/* Prénom + Nom */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Prénom</label>
                <input
                  type="text"
                  value={tmFirstName}
                  onChange={(e) => setTmFirstName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  placeholder="Jean"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Nom</label>
                <input
                  type="text"
                  value={tmLastName}
                  onChange={(e) => setTmLastName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  placeholder="Dupont"
                  required
                />
              </div>
            </div>

            {/* Date de naissance */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Date de naissance</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  type="date"
                  value={tmDob}
                  onChange={(e) => setTmDob(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              {tmAge !== null && tmAge >= 0 && (
                <p className="text-xs text-slate-500 mt-1.5">{tmAge} ans</p>
              )}
            </div>

            {/* Téléphone */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Téléphone</label>
              <div className="flex gap-2">
                <div className="relative" ref={tmCountryRef}>
                  <button
                    type="button"
                    onClick={() => { setIsTmCountryOpen(!isTmCountryOpen); setTmCountrySearch(''); }}
                    className="w-28 shrink-0 rounded-xl border border-slate-200 bg-slate-50 py-3 px-3 text-slate-900 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none text-left truncate"
                  >
                    {tmSelectedCountry ? `${tmSelectedCountry.dial_code} ${tmSelectedCountry.code}` : tmCountryCode}
                  </button>
                  {isTmCountryOpen && (
                    <div className="absolute top-full left-0 mt-1 w-64 max-h-60 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                      <div className="sticky top-0 bg-white p-2 border-b border-slate-100">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <input
                            type="text"
                            value={tmCountrySearch}
                            onChange={(e) => setTmCountrySearch(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm text-slate-900 focus:border-amber-500 focus:outline-none"
                            placeholder="Rechercher un pays..."
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="overflow-y-auto max-h-48">
                        {tmFilteredCountries.map((c) => (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => { setTmCountryCode(c.dial_code); setIsTmCountryOpen(false); setTmCountrySearch(''); }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-amber-50 transition-colors flex items-center justify-between ${
                              tmCountryCode === c.dial_code ? 'bg-amber-50 text-amber-700 font-medium' : 'text-slate-700'
                            }`}
                          >
                            <span className="truncate">{c.name}</span>
                            <span className="text-slate-400 ml-2 shrink-0">{c.dial_code}</span>
                          </button>
                        ))}
                        {tmFilteredCountries.length === 0 && (
                          <p className="px-3 py-4 text-sm text-slate-400 text-center">Aucun résultat</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <input
                  type="tel"
                  value={tmPhone}
                  onChange={(e) => setTmPhone(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  placeholder="6 12 34 56 78"
                />
              </div>
            </div>

            <button
              onClick={handleTmSubmit}
              disabled={loading || !tmFirstName || !tmLastName}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 py-3.5 font-bold text-white transition-all hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
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

  const onCropComplete = (_: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
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
        phone: phone ? `${countryCode} ${phone}` : '',
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
    } catch (err) {
      console.error('Onboarding error:', err);
    } finally {
      setLoading(false);
    }
  };

  const initials = fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      {/* Crop overlay */}
      {imageSrc && (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-lg h-[400px] relative rounded-xl overflow-hidden border border-amber-700/30 bg-slate-900 mb-6">
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
              <ZoomOut className="h-5 w-5 text-slate-400" />
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <ZoomIn className="h-5 w-5 text-slate-400" />
            </div>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => { setImageSrc(null); setZoom(1); }}
                disabled={uploading}
                className="px-6 py-3 rounded-xl border border-slate-700 text-slate-300 font-bold hover:bg-slate-800 transition-colors flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Annuler
              </button>
              <button
                onClick={showCroppedImage}
                disabled={uploading}
                className="px-6 py-3 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-500 transition-colors shadow-lg flex items-center gap-2"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Valider la photo
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Progress indicator */}
        <div className="flex items-center gap-2 mb-8">
          <div className={`h-1.5 flex-1 rounded-full ${step >= 1 ? 'bg-amber-500' : 'bg-slate-200'}`} />
          <div className={`h-1.5 flex-1 rounded-full ${step >= 2 ? 'bg-amber-500' : 'bg-slate-200'}`} />
        </div>

        {step === 1 && (
          <>
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-amber-50">
                  <Briefcase className="h-5 w-5 text-amber-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Votre profil</h2>
              </div>
              <p className="text-slate-500 text-sm">Présentez-vous en quelques secondes</p>
            </div>

            <div className="space-y-4">
              {/* Avatar */}
              <div className="flex justify-center mb-2">
                <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
                  <div className="w-20 h-20 rounded-full border-2 border-amber-200 overflow-hidden bg-amber-50 flex items-center justify-center transition-all group-hover:border-amber-500">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Profil" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-bold text-amber-600">
                        {initials || <User className="w-8 h-8 text-amber-400" />}
                      </span>
                    )}
                  </div>
                  <div className="absolute bottom-0 right-0 bg-amber-600 p-1.5 rounded-full border-2 border-white text-white shadow-sm group-hover:scale-110 transition-transform">
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
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Nom complet</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  placeholder="John Doe"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Téléphone</label>
                <div className="flex gap-2">
                  {/* Searchable country code dropdown */}
                  <div className="relative" ref={countryDropdownRef}>
                    <button
                      type="button"
                      onClick={() => { setIsCountryDropdownOpen(!isCountryDropdownOpen); setCountrySearch(''); }}
                      className="w-28 shrink-0 rounded-xl border border-slate-200 bg-slate-50 py-3 px-3 text-slate-900 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none text-left truncate"
                    >
                      {selectedCountry ? `${selectedCountry.dial_code} ${selectedCountry.code}` : countryCode}
                    </button>
                    {isCountryDropdownOpen && (
                      <div className="absolute top-full left-0 mt-1 w-64 max-h-60 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                        <div className="sticky top-0 bg-white p-2 border-b border-slate-100">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                              type="text"
                              value={countrySearch}
                              onChange={(e) => setCountrySearch(e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm text-slate-900 focus:border-amber-500 focus:outline-none"
                              placeholder="Rechercher un pays..."
                              autoFocus
                            />
                          </div>
                        </div>
                        <div className="overflow-y-auto max-h-48">
                          {filteredCountries.map((c) => (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => {
                                setCountryCode(c.dial_code);
                                setIsCountryDropdownOpen(false);
                                setCountrySearch('');
                              }}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-amber-50 transition-colors flex items-center justify-between ${
                                countryCode === c.dial_code ? 'bg-amber-50 text-amber-700 font-medium' : 'text-slate-700'
                              }`}
                            >
                              <span className="truncate">{c.name}</span>
                              <span className="text-slate-400 ml-2 shrink-0">{c.dial_code}</span>
                            </button>
                          ))}
                          {filteredCountries.length === 0 && (
                            <p className="px-3 py-4 text-sm text-slate-400 text-center">Aucun résultat</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    placeholder="6 12 34 56 78"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Votre rôle</label>
                <div className="grid grid-cols-2 gap-2">
                  {['CEO / Fondateur', 'Sales Manager', 'Business Developer', 'Autre'].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`rounded-xl border py-2.5 px-3 text-sm font-medium transition-all ${
                        role === r
                          ? 'border-amber-500 bg-amber-50 text-amber-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
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
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 py-3.5 font-bold text-white transition-all hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
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
                <div className="p-2 rounded-lg bg-amber-50">
                  <Building2 className="h-5 w-5 text-amber-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Votre entreprise</h2>
              </div>
              <p className="text-slate-500 text-sm">Configurez votre espace Business</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Nom de l'entreprise</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  placeholder="Mon entreprise"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Taille de l'équipe</label>
                <div className="flex flex-wrap gap-2">
                  {TEAM_SIZES.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setTeamSize(size)}
                      className={`rounded-xl border py-2 px-4 text-sm font-medium transition-all ${
                        teamSize === size
                          ? 'border-amber-500 bg-amber-50 text-amber-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Niche / Secteur</label>
                <div className="grid grid-cols-2 gap-2">
                  {NICHES.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNiche(n)}
                      className={`rounded-xl border py-2 px-3 text-sm font-medium transition-all ${
                        niche === n
                          ? 'border-amber-500 bg-amber-50 text-amber-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
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
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    placeholder="Précisez votre secteur..."
                  />
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 rounded-xl border border-slate-200 py-3 font-medium text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Retour
                </button>
                <button
                  onClick={handleStep2}
                  disabled={loading || !companyName || !teamSize || !niche}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-600 py-3 font-bold text-white transition-all hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
