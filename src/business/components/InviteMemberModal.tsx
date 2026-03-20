import { useState } from 'react';
import { X, Copy, Check, Loader2, Link as LinkIcon } from 'lucide-react';
import { useBusinessAuth } from '../contexts/BusinessAuthContext';

const DEFAULT_ROLES = ['Closer', 'Setter', 'Setter-Closer', 'Manager', 'Admin', 'Head of Sales'];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function InviteMemberModal({ isOpen, onClose }: Props) {
  const { user, businessSettings } = useBusinessAuth();
  const [selectedRole, setSelectedRole] = useState('Closer');
  const [customRole, setCustomRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [canManageCampaigns, setCanManageCampaigns] = useState(false);
  const [setterScope, setSetterScope] = useState<'self' | 'all'>('self');

  if (!isOpen) return null;

  const customRoles: string[] = businessSettings?.custom_roles || [];
  const allRoles = [...DEFAULT_ROLES, ...customRoles];

  const handleGenerate = async () => {
    setLoading(true);
    setGeneratedLink(null);

    try {
      const role = selectedRole === '__custom' ? customRole : selectedRole;
      if (!role) return;

      const res = await fetch('/api/business-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviter_id: user.id,
          role,
          can_manage_campaigns: role === 'Head of Sales' ? canManageCampaigns : false,
          setter_scope: role === 'Setter-Closer' ? setterScope : null,
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
    setCustomRole('');
    setCopied(false);
    setCanManageCampaigns(false);
    setSetterScope('self');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-xl font-bold text-slate-900 mb-2">Inviter un membre</h2>
        <p className="text-slate-500 text-sm mb-6">Générez un lien d'invitation pour un nouveau membre de votre équipe.</p>

        {!generatedLink ? (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Rôle</label>
              <div className="flex flex-wrap gap-2">
                {allRoles.map((role) => (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(role)}
                    className={`rounded-lg border py-2 px-3 text-sm font-medium transition-all ${
                      selectedRole === role
                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {role}
                  </button>
                ))}
                <button
                  onClick={() => setSelectedRole('__custom')}
                  className={`rounded-lg border py-2 px-3 text-sm font-medium transition-all ${
                    selectedRole === '__custom'
                      ? 'border-amber-500 bg-amber-50 text-amber-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Personnalisé
                </button>
              </div>
            </div>

            {selectedRole === '__custom' && (
              <div className="mb-4">
                <input
                  type="text"
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-4 text-sm text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  placeholder="Nom du rôle personnalisé..."
                />
              </div>
            )}

            {selectedRole === 'Head of Sales' && (
              <div className="mb-4 rounded-xl border border-purple-200 bg-purple-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Gestion des campagnes</p>
                    <p className="text-xs text-slate-500 mt-0.5">Lui donner accès à la page Campagnes</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCanManageCampaigns(!canManageCampaigns)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      canManageCampaigns ? 'bg-purple-600' : 'bg-slate-300'
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
              <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                <p className="text-sm font-medium text-slate-900 mb-3">Mode de setting</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSetterScope('self')}
                    className={`flex-1 rounded-lg border py-2.5 px-3 text-sm font-medium transition-all ${
                      setterScope === 'self'
                        ? 'border-indigo-500 bg-indigo-100 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Set pour lui-même
                  </button>
                  <button
                    type="button"
                    onClick={() => setSetterScope('all')}
                    className={`flex-1 rounded-lg border py-2.5 px-3 text-sm font-medium transition-all ${
                      setterScope === 'all'
                        ? 'border-indigo-500 bg-indigo-100 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Set pour tout le monde
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {setterScope === 'self'
                    ? "Ne peut booker que pour lui-même et ne peut pas assigner de prospects à d'autres closers."
                    : "Peut booker des RDV pour les autres membres et assigner des prospects aux closers."
                  }
                </p>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={loading || (selectedRole === '__custom' && !customRole)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-600 py-3 font-bold text-white hover:bg-amber-500 transition-all disabled:opacity-50"
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
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-medium text-emerald-700 mb-2">Lien d'invitation généré !</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={generatedLink}
                  readOnly
                  className="flex-1 rounded-lg border border-emerald-200 bg-white py-2 px-3 text-xs text-slate-700 font-mono"
                />
                <button
                  onClick={handleCopy}
                  className="rounded-lg bg-emerald-600 p-2 text-white hover:bg-emerald-500 transition-colors"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-emerald-600 mt-2">Ce lien expire dans 7 jours.</p>
            </div>

            <button
              onClick={handleClose}
              className="w-full rounded-xl border border-slate-200 py-3 font-medium text-slate-600 hover:bg-slate-50 transition-all"
            >
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
