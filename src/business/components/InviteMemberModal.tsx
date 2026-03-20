import { useState } from 'react';
import { X, Copy, Check, Loader2, Link as LinkIcon, Eye, Pencil, UserCheck } from 'lucide-react';
import { useBusinessAuth } from '../contexts/BusinessAuthContext';

const DEFAULT_ROLES = ['Closer', 'Setter', 'Setter-Closer', 'Admin', 'Head of Sales'];

// Pages configurables pour rôle personnalisé
// assignable = true → on peut activer/désactiver le droit d'assigner
const CONFIGURABLE_PAGES = [
  { key: 'dashboard', label: 'Dashboard', assignable: false },
  { key: 'crm', label: 'CRM', assignable: true },
  { key: 'pipeline', label: 'Pipeline', assignable: false },
  { key: 'campagnes', label: 'Campagnes', assignable: false },
  { key: 'acquisition', label: 'Acquisition', assignable: false },
  { key: 'objectifs', label: 'Objectifs', assignable: true },
  { key: 'formules', label: 'Formules', assignable: false },
  { key: 'appels', label: 'Appels', assignable: false },
  { key: 'rendez-vous', label: 'Rendez-vous', assignable: true },
  { key: 'agenda', label: 'Agenda', assignable: false },
  { key: 'rappels', label: 'Rappels', assignable: false },
  { key: 'factures', label: 'Factures', assignable: false },
  { key: 'rapport', label: 'Rapport', assignable: false },
  { key: 'kpi', label: 'KPI', assignable: false },
  { key: 'equipe', label: 'Équipe', assignable: false },
] as const;

export interface PagePermission {
  access: boolean;
  write: boolean;
  assign: boolean;
}

export type CustomPermissions = {
  pages: Record<string, PagePermission>;
};

function getDefaultPermissions(): CustomPermissions {
  const pages: Record<string, PagePermission> = {};
  for (const p of CONFIGURABLE_PAGES) {
    pages[p.key] = { access: false, write: false, assign: false };
  }
  return { pages };
}

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
  const [customPermissions, setCustomPermissions] = useState<CustomPermissions>(getDefaultPermissions);

  if (!isOpen) return null;

  const customRoles: string[] = businessSettings?.custom_roles || [];
  const allRoles = [...DEFAULT_ROLES, ...customRoles];

  const isCustomRole = selectedRole === '__custom';

  const updatePagePerm = (pageKey: string, field: keyof PagePermission, value: boolean) => {
    setCustomPermissions(prev => {
      const pages = { ...prev.pages };
      const current = { ...pages[pageKey] };

      if (field === 'access' && !value) {
        // Désactiver l'accès → tout reset
        current.access = false;
        current.write = false;
        current.assign = false;
      } else if (field === 'write' && !value) {
        current.write = false;
        current.assign = false; // pas d'assign sans write
      } else {
        current[field] = value;
        if (field === 'write' && value) current.access = true;
        if (field === 'assign' && value) { current.access = true; current.write = true; }
      }

      pages[pageKey] = current;
      return { pages };
    });
  };

  const handleGenerate = async () => {
    setLoading(true);
    setGeneratedLink(null);

    try {
      const role = isCustomRole ? customRole : selectedRole;
      if (!role) return;

      const body: any = {
        inviter_id: user.id,
        role,
        can_manage_campaigns: role === 'Head of Sales' ? canManageCampaigns : false,
        setter_scope: role === 'Setter-Closer' ? setterScope : null,
      };

      if (isCustomRole) {
        body.custom_permissions = customPermissions;
      }

      const res = await fetch('/api/business-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
    setCustomPermissions(getDefaultPermissions());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className={`w-full ${isCustomRole ? 'max-w-lg' : 'max-w-md'} rounded-2xl border border-amber-200 bg-white shadow-2xl relative animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col`}>
        <div className="p-6 pb-0">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <h2 className="text-xl font-bold text-slate-900 mb-2">Inviter un membre</h2>
          <p className="text-slate-500 text-sm mb-6">Générez un lien d'invitation pour un nouveau membre de votre équipe.</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
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
                      isCustomRole
                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Personnalisé
                  </button>
                </div>
              </div>

              {/* Admin info */}
              {selectedRole === 'Admin' && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-medium text-red-800">Accès complet</p>
                  <p className="text-xs text-red-600 mt-0.5">Un Admin a exactement les mêmes droits que le Owner sur toute la plateforme.</p>
                </div>
              )}

              {/* Custom role: name + permissions */}
              {isCustomRole && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom du rôle</label>
                    <input
                      type="text"
                      value={customRole}
                      onChange={(e) => setCustomRole(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-4 text-sm text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                      placeholder="Ex: Assistant, Comptable..."
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Permissions par page</label>
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      {/* Header */}
                      <div className="grid grid-cols-[1fr_60px_60px_60px] gap-0 bg-slate-50 border-b border-slate-200 px-3 py-2">
                        <span className="text-xs font-semibold text-slate-500">Page</span>
                        <span className="text-xs font-semibold text-slate-500 text-center" title="Peut voir la page">
                          <Eye className="h-3.5 w-3.5 mx-auto" />
                        </span>
                        <span className="text-xs font-semibold text-slate-500 text-center" title="Peut modifier/créer">
                          <Pencil className="h-3.5 w-3.5 mx-auto" />
                        </span>
                        <span className="text-xs font-semibold text-slate-500 text-center" title="Peut assigner">
                          <UserCheck className="h-3.5 w-3.5 mx-auto" />
                        </span>
                      </div>

                      {/* Rows */}
                      {CONFIGURABLE_PAGES.map((page) => {
                        const perm = customPermissions.pages[page.key];
                        return (
                          <div key={page.key} className="grid grid-cols-[1fr_60px_60px_60px] gap-0 items-center border-b border-slate-100 last:border-0 px-3 py-2 hover:bg-slate-50/50">
                            <span className="text-sm text-slate-700">{page.label}</span>

                            {/* Voir */}
                            <div className="flex justify-center">
                              <button
                                type="button"
                                onClick={() => updatePagePerm(page.key, 'access', !perm.access)}
                                className={`h-5 w-5 rounded border-2 transition-all flex items-center justify-center ${
                                  perm.access ? 'border-amber-500 bg-amber-500' : 'border-slate-300 bg-white'
                                }`}
                              >
                                {perm.access && <Check className="h-3 w-3 text-white" />}
                              </button>
                            </div>

                            {/* Écrire */}
                            <div className="flex justify-center">
                              <button
                                type="button"
                                disabled={!perm.access}
                                onClick={() => updatePagePerm(page.key, 'write', !perm.write)}
                                className={`h-5 w-5 rounded border-2 transition-all flex items-center justify-center ${
                                  !perm.access ? 'border-slate-200 bg-slate-100 cursor-not-allowed' :
                                  perm.write ? 'border-amber-500 bg-amber-500' : 'border-slate-300 bg-white'
                                }`}
                              >
                                {perm.write && <Check className="h-3 w-3 text-white" />}
                              </button>
                            </div>

                            {/* Assigner */}
                            <div className="flex justify-center">
                              {page.assignable ? (
                                <button
                                  type="button"
                                  disabled={!perm.write}
                                  onClick={() => updatePagePerm(page.key, 'assign', !perm.assign)}
                                  className={`h-5 w-5 rounded border-2 transition-all flex items-center justify-center ${
                                    !perm.write ? 'border-slate-200 bg-slate-100 cursor-not-allowed' :
                                    perm.assign ? 'border-amber-500 bg-amber-500' : 'border-slate-300 bg-white'
                                  }`}
                                >
                                  {perm.assign && <Check className="h-3 w-3 text-white" />}
                                </button>
                              ) : (
                                <span className="text-slate-300 text-xs">—</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-slate-400 mt-2 flex items-center gap-3">
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> Voir</span>
                      <span className="flex items-center gap-1"><Pencil className="h-3 w-3" /> Écrire</span>
                      <span className="flex items-center gap-1"><UserCheck className="h-3 w-3" /> Assigner</span>
                    </p>
                  </div>
                </>
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
                disabled={loading || (isCustomRole && !customRole)}
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
    </div>
  );
}
