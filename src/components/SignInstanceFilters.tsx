import { Search } from 'lucide-react';

/**
 * Barre de filtres réutilisable pour les listes d'instances (signatures) —
 * côté propriétaire (SignTemplateDashboard) et côté closer (SignRepSpace).
 * Recherche (nom/email) + statut (tous / en cours / signés / expirés) + période (du → au).
 * Définie AU NIVEAU MODULE → identité stable → pas de perte de focus des inputs.
 */
export type InstanceFilter = {
  q: string;
  status: 'all' | 'en_cours' | 'signe' | 'expire';
  from: string; // yyyy-mm-dd
  to: string; // yyyy-mm-dd
};

export const EMPTY_INSTANCE_FILTER: InstanceFilter = { q: '', status: 'all', from: '', to: '' };

/** Un filtre est-il actif (≠ état par défaut) ? */
export const isFilterActive = (f: InstanceFilter) =>
  f.q.trim() !== '' || f.status !== 'all' || f.from !== '' || f.to !== '';

/** Prédicat de filtrage générique sur une instance (propriétaire ou closer). */
export function matchInstance(
  it: { effectiveStatus: string; signerName: string | null; signerEmail: string | null; createdAt: string; signedAt: string | null },
  f: InstanceFilter,
): boolean {
  // Statut
  if (f.status === 'en_cours' && !(it.effectiveStatus === 'en_cours' || it.effectiveStatus === 'consulte')) return false;
  if (f.status === 'signe' && !(it.effectiveStatus === 'signe' || it.effectiveStatus === 'paye')) return false;
  if (f.status === 'expire' && it.effectiveStatus !== 'expire') return false;
  // Recherche (nom / email)
  const q = f.q.trim().toLowerCase();
  if (q && !`${it.signerName ?? ''} ${it.signerEmail ?? ''}`.toLowerCase().includes(q)) return false;
  // Période sur la date pertinente (signature sinon création) — comparaison sur la partie date ISO
  if (f.from || f.to) {
    const ref = it.signedAt ?? it.createdAt;
    const d = ref ? ref.slice(0, 10) : '';
    if (f.from && d < f.from) return false;
    if (f.to && d > f.to) return false;
  }
  return true;
}

const STATUSES: { k: InstanceFilter['status']; label: string }[] = [
  { k: 'all', label: 'Tous' },
  { k: 'en_cours', label: 'En cours' },
  { k: 'signe', label: 'Signés' },
  { k: 'expire', label: 'Expirés' },
];

export default function SignInstanceFilters({
  value,
  onChange,
}: {
  value: InstanceFilter;
  onChange: (f: InstanceFilter) => void;
}) {
  const set = (patch: Partial<InstanceFilter>) => onChange({ ...value, ...patch });
  const dateCls =
    'rounded-lg border border-[#3A4242] bg-[#191E1E] px-2.5 py-2 text-xs text-white outline-none transition-colors focus:border-[#CEFF8F]';

  return (
    <div className="flex flex-col gap-3 border-b border-[#3A4242] px-5 py-3 lg:flex-row lg:items-center lg:justify-between">
      {/* Recherche */}
      <div className="relative min-w-0 lg:max-w-xs lg:flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
        <input
          value={value.q}
          onChange={(e) => set({ q: e.target.value })}
          placeholder="Rechercher (nom, email)"
          className="w-full rounded-lg border border-[#3A4242] bg-[#191E1E] py-2 pl-9 pr-3 text-sm text-white outline-none transition-colors placeholder:text-[#A1A9A9]/50 focus:border-[#CEFF8F]"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Statut (segmenté) */}
        <div className="flex rounded-lg border border-[#3A4242] p-0.5">
          {STATUSES.map((s) => {
            const active = value.status === s.k;
            return (
              <button
                key={s.k}
                type="button"
                onClick={() => set({ status: s.k })}
                className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${active ? 'bg-[#CEFF8F] text-[#191E1E]' : 'text-[#A1A9A9] hover:text-white'}`}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Période */}
        <div className="flex items-center gap-1.5">
          <input type="date" value={value.from} onChange={(e) => set({ from: e.target.value })} title="À partir du" className={dateCls} style={{ colorScheme: 'dark' }} />
          <span className="text-xs text-[#A1A9A9]">→</span>
          <input type="date" value={value.to} onChange={(e) => set({ to: e.target.value })} title="Jusqu'au" className={dateCls} style={{ colorScheme: 'dark' }} />
        </div>
      </div>
    </div>
  );
}
