import { useState } from 'react';
import { ArrowRight, Loader2, Building2, Users, Briefcase, ChevronRight } from 'lucide-react';
import { useBusinessAuth } from '../contexts/BusinessAuthContext';

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

export function BusinessOnboardingModal() {
  const { user, businessProfile, hasOnboarded, loading: authLoading, updateBusinessProfile, updateBusinessSettings } = useBusinessAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Profile
  const [fullName, setFullName] = useState(businessProfile?.full_name || user?.user_metadata?.full_name || '');
  const [phone, setPhone] = useState(businessProfile?.phone || '');
  const [role, setRole] = useState(businessProfile?.role || '');

  // Step 2: Company
  const [companyName, setCompanyName] = useState('');
  const [teamSize, setTeamSize] = useState('');
  const [niche, setNiche] = useState('');
  const [nicheCustom, setNicheCustom] = useState('');

  // Don't show if already onboarded, no user, or still loading
  if (!user || hasOnboarded || authLoading) return null;

  const handleStep1 = async () => {
    if (!fullName || !role) return;
    setStep(2);
  };

  const handleStep2 = async () => {
    if (!companyName || !teamSize || !niche) return;
    setLoading(true);

    try {
      // Update business profile
      await updateBusinessProfile({
        full_name: fullName,
        phone,
        role,
        has_onboarded: true,
      });

      // Create business settings
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
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
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  placeholder="+33 6 12 34 56 78"
                />
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
