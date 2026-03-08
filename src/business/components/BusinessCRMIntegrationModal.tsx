import { useState } from 'react';
import { X, Check, ExternalLink } from 'lucide-react';
import { useBusinessAuth } from '../contexts/BusinessAuthContext';

const CRM_OPTIONS = [
  {
    id: 'closeos',
    name: 'CloseOS',
    description: 'CRM intégré CloseOS',
    color: 'bg-amber-500',
    textColor: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-300',
  },
  {
    id: 'iclosed',
    name: 'iClosed',
    description: 'Connectez votre compte iClosed',
    color: 'bg-blue-500',
    textColor: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'Synchronisez avec HubSpot CRM',
    color: 'bg-orange-500',
    textColor: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-300',
  },
  {
    id: 'pipedrive',
    name: 'Pipedrive',
    description: 'Connectez votre pipeline Pipedrive',
    color: 'bg-green-500',
    textColor: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-300',
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function BusinessCRMIntegrationModal({ isOpen, onClose }: Props) {
  const { businessSettings, updateBusinessSettings } = useBusinessAuth();
  const [selected, setSelected] = useState(businessSettings?.crm_provider || 'closeos');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateBusinessSettings({ crm_provider: selected });
      onClose();
    } catch (err) {
      console.error('Error saving CRM provider:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-xl font-bold text-slate-900 mb-2">Intégration CRM</h2>
        <p className="text-slate-500 text-sm mb-6">Choisissez votre CRM pour synchroniser vos données.</p>

        <div className="space-y-3">
          {CRM_OPTIONS.map((crm) => (
            <button
              key={crm.id}
              onClick={() => setSelected(crm.id)}
              className={`w-full flex items-center gap-4 rounded-xl border p-4 transition-all text-left ${
                selected === crm.id
                  ? `${crm.borderColor} ${crm.bgColor}`
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className={`h-10 w-10 rounded-lg ${crm.color} flex items-center justify-center`}>
                <span className="text-white font-bold text-sm">{crm.name[0]}</span>
              </div>
              <div className="flex-1">
                <p className={`font-semibold ${selected === crm.id ? crm.textColor : 'text-slate-800'}`}>
                  {crm.name}
                </p>
                <p className="text-xs text-slate-500">{crm.description}</p>
              </div>
              {selected === crm.id && (
                <Check className={`h-5 w-5 ${crm.textColor}`} />
              )}
            </button>
          ))}
        </div>

        {(selected === 'hubspot' || selected === 'pipedrive') && (
          <div className="mt-4 p-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-700 flex items-start gap-2">
            <ExternalLink className="h-4 w-4 mt-0.5 shrink-0" />
            <span>La connexion {selected === 'hubspot' ? 'HubSpot' : 'Pipedrive'} sera configurée dans les paramètres de vos offres.</span>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 py-3 font-medium text-slate-600 hover:bg-slate-50 transition-all"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 rounded-xl bg-amber-600 py-3 font-bold text-white hover:bg-amber-500 transition-all disabled:opacity-50"
          >
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
