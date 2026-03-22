import { useState } from 'react';
import { X, Copy, Check, Loader2, Link as LinkIcon } from 'lucide-react';
import { useBusinessAuth } from '../contexts/BusinessAuthContext';

const DEFAULT_ROLES = ['Closer', 'Setter', 'Setter-Closer', 'Admin', 'Head of Sales'];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function InviteMemberModal({ isOpen, onClose }: Props) {
  const { user, businessSettings } = useBusinessAuth();
  const [selectedRole, setSelectedRole] = useState('Closer');
  const [loading, setLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [canManageCampaigns, setCanManageCampaigns] = useState(false);
  const [setterScope, setSetterScope] = useState<'self' | 'all'>('self');

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setLoading(true);
    setGeneratedLink(null);

    try {
      const res = await fetch('/api/business-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviter_id: user.id,
          role: selectedRole,
          can_manage_campaigns: selectedRole === 'Head of Sales' ? canManageCampaigns : false,
          setter_scope: selectedRole === 'Setter-Closer' ? setterScope : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error('Error creating invitation:', data.error);
        return;
      }

      const link = `${window.location.origin}/business/invitation/${data.token}`;
      setGeneratedLink(link);
    } catch (err) {
      console.error('Error generating invitation:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setGeneratedLink(null);
    setSelectedRole('Closer');
    setCopied(false);
    setCanManageCampaigns(false);
    setSetterScope('self');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-md p-4">
      <div className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-xl shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-stone-200/20 p-6 relative animate-in zoom-in-95 duration-200">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-xl font-['Manrope'] font-extrabold tracking-tight text-stone-900 mb-2">Inviter un membre</h2>
        <p className="text-stone-500 text-sm mb-6">Générez un lien d'invitation pour un nouveau membre de votre équipe.</p>

        {!generatedLink ? (
          <>
            <div className="mb-4">
              <label className="block text-[0.75rem] font-semibold uppercase tracking-widest text-stone-500 mb-2">Rôle</label>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_ROLES.map((role) => (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(role)}
                    className={`rounded-full border py-2 px-3 text-sm font-medium transition-all ${
                      selectedRole === role
                        ? 'border-stone-900 bg-stone-900 text-white'
                        : 'border-stone-300 bg-white text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            {/* Admin info */}
            {selectedRole === 'Admin' && (
              <div className="mb-4 rounded-xl border border-red-200/60 bg-red-50/50 p-4">
                <p className="text-sm font-semibold text-red-800">Accès complet</p>
                <p className="text-xs text-red-600 mt-0.5">Un Admin a exactement les mêmes droits que le Owner sur toute la plateforme.</p>
              </div>
            )}

            {selectedRole === 'Head of Sales' && (
              <div className="mb-4 rounded-xl border border-stone-200/20 bg-stone-100/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-stone-900">Gestion des campagnes</p>
                    <p className="text-xs text-stone-500 mt-0.5">Lui donner accès à la page Campagnes</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCanManageCampaigns(!canManageCampaigns)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      canManageCampaigns ? 'bg-emerald-600' : 'bg-stone-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition-transform duration-200 ease-in-out ${
                        canManageCampaigns ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}

            {selectedRole === 'Setter-Closer' && (
              <div className="mb-4 rounded-xl border border-stone-200/20 bg-stone-100/50 p-4">
                <p className="text-sm font-semibold text-stone-900 mb-3">Mode de setting</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSetterScope('self')}
                    className={`flex-1 rounded-full border py-2.5 px-3 text-sm font-medium transition-all ${
                      setterScope === 'self'
                        ? 'border-stone-900 bg-stone-900 text-white'
                        : 'border-stone-300 bg-white text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    Set pour lui-même
                  </button>
                  <button
                    type="button"
                    onClick={() => setSetterScope('all')}
                    className={`flex-1 rounded-full border py-2.5 px-3 text-sm font-medium transition-all ${
                      setterScope === 'all'
                        ? 'border-stone-900 bg-stone-900 text-white'
                        : 'border-stone-300 bg-white text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    Set pour tout le monde
                  </button>
                </div>
                <p className="text-xs text-stone-500 mt-2">
                  {setterScope === 'self'
                    ? "Ne peut booker que pour lui-même et ne peut pas assigner de prospects à d'autres closers."
                    : "Peut booker des RDV pour les autres membres et assigner des prospects aux closers."
                  }
                </p>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-full bg-stone-900 py-3 font-bold text-white shadow-lg hover:bg-stone-800 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <LinkIcon className="h-4 w-4" />
                  Générer le lien
                </>
              )}
            </button>
          </>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/50 p-4">
              <p className="text-sm font-semibold text-emerald-700 mb-2">Lien d'invitation généré !</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={generatedLink}
                  readOnly
                  className="flex-1 rounded-full bg-stone-100/50 border-none py-2 px-3 text-xs text-stone-700 font-mono focus:ring-2 focus:ring-emerald-600/20"
                />
                <button
                  onClick={handleCopy}
                  className="rounded-full bg-emerald-600 p-2 text-white hover:bg-emerald-500 active:scale-95 transition-all"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-emerald-600 mt-2">Ce lien expire dans 7 jours.</p>
            </div>

            <button
              onClick={handleClose}
              className="w-full rounded-full border border-stone-300 py-3 font-medium text-stone-700 hover:bg-stone-50 active:scale-95 transition-all"
            >
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
