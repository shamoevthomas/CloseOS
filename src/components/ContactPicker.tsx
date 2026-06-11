import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Search, UserCheck, Folder, Building2, Users, Tag, Loader2 } from 'lucide-react';
import type { SignContact, SignContactGroup } from '../lib/signContracts';
import { loadCrmTree, materializeCrmPerson, flattenCrm, type CrmTree, type CrmPerson } from '../lib/signCrm';

/**
 * Sélecteur de contact (DA Sign). Affiche d'abord le dossier synchronisé « CRM CloseOS »
 * (Prospects gagnés par offre + Équipe), puis les DOSSIERS manuels (repliés), puis les
 * contacts sans dossier. Choisir une personne du CRM la matérialise en contact Sign.
 * La recherche aplatit la liste (CRM inclus).
 */
export default function ContactPicker({
  contacts,
  groups = [],
  onSelect,
}: {
  contacts: SignContact[];
  groups?: SignContactGroup[];
  onSelect: (c: SignContact) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState('');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ crm: false });
  const [crm, setCrm] = useState<CrmTree | null>(null);
  const [crmLoading, setCrmLoading] = useState(false);
  const [crmBusy, setCrmBusy] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // Chargement paresseux du CRM à la première ouverture
  useEffect(() => {
    if (!open || crm || crmLoading) return;
    setCrmLoading(true);
    loadCrmTree()
      .then(setCrm)
      .catch((e) => console.error('[sign] CRM', e))
      .finally(() => setCrmLoading(false));
  }, [open, crm, crmLoading]);

  const q = search.trim().toLowerCase();
  const match = (c: SignContact) => !q || `${c.name} ${c.email}`.toLowerCase().includes(q);
  const filtered = contacts.filter(match);
  const ungrouped = filtered.filter((c) => !c.groupId);
  const searching = q.length > 0;
  const crmMatches = searching
    ? flattenCrm(crm).filter((p) => `${p.name} ${p.email} ${p.company ?? ''} ${p.offerName ?? ''} ${p.role ?? ''}`.toLowerCase().includes(q))
    : [];

  const toggle = (k: string) => setExpanded((p) => ({ ...p, [k]: !p[k] }));

  const choose = (c: SignContact) => {
    onSelect(c);
    setPicked(c.name || c.email);
    setOpen(false);
    setSearch('');
  };

  const chooseCrm = async (p: CrmPerson) => {
    const key = `${p.kind}:${p.externalId}`;
    setCrmBusy(key);
    try {
      const real = await materializeCrmPerson(p);
      choose(real);
    } catch (e) {
      console.error('[sign] matérialisation contact CRM', e);
    } finally {
      setCrmBusy(null);
    }
  };

  const ContactBtn = (c: SignContact, indent = false) => (
    <button
      key={c.id}
      type="button"
      onClick={() => choose(c)}
      className={`flex w-full flex-col items-start py-2 pr-3 text-left transition-colors hover:bg-[#191E1E] ${indent ? 'pl-9' : 'pl-3'}`}
    >
      <span className="truncate text-sm text-white">{c.name || c.email}</span>
      {c.name && <span className="truncate text-xs text-[#A1A9A9]">{c.email}</span>}
    </button>
  );

  const CrmPersonBtn = (p: CrmPerson, pad: string) => {
    const key = `${p.kind}:${p.externalId}`;
    const busy = crmBusy === key;
    const tag = p.kind === 'team' ? p.role : p.offerName;
    return (
      <button
        key={key}
        type="button"
        disabled={!!crmBusy}
        onClick={() => chooseCrm(p)}
        className={`flex w-full items-center gap-2 py-2 pr-3 text-left transition-colors hover:bg-[#191E1E] disabled:opacity-60 ${pad}`}
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm text-white">{p.name || p.email}</span>
            {tag && <span className="shrink-0 rounded bg-[#191E1E] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#A1A9A9]">{tag}</span>}
          </span>
          {p.name && <span className="block truncate text-xs text-[#A1A9A9]">{p.email}</span>}
        </span>
        {busy && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#CEFF8F]" />}
      </button>
    );
  };

  const crmOpen = !!expanded.crm;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded border border-[#3A4242] bg-[#191E1E] px-3 py-2.5 text-sm text-white outline-none transition-colors hover:border-[#CEFF8F]"
      >
        <span className="flex min-w-0 items-center gap-2">
          <UserCheck className="h-4 w-4 shrink-0 text-[#CEFF8F]" />
          <span className="truncate">{picked || 'Choisir un contact…'}</span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#A1A9A9]" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-lg border border-[#3A4242] bg-[#222828] shadow-2xl">
          <div className="relative border-b border-[#3A4242] p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#A1A9A9]" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un contact…"
              className="w-full rounded border border-[#3A4242] bg-[#191E1E] py-2 pl-8 pr-3 text-sm text-white outline-none placeholder:text-[#A1A9A9]/50 focus:border-[#CEFF8F]"
            />
          </div>
          <ul className="max-h-80 overflow-y-auto py-1">
            {/* ===== Dossier synchronisé CRM CloseOS (hors recherche) ===== */}
            {!searching && crm?.hasBusiness && (
              <li className="border-b border-[#3A4242] pb-1">
                <button
                  type="button"
                  onClick={() => toggle('crm')}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[#191E1E]"
                >
                  {crmOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#A1A9A9]" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#A1A9A9]" />}
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-[#CEFF8F]" />
                  <span className="flex-1 truncate text-sm font-semibold text-white">CRM CloseOS</span>
                  <span className="shrink-0 rounded-full bg-[#CEFF8F]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#CEFF8F]">Sync</span>
                </button>

                {crmOpen && (
                  <div>
                    {/* Prospects */}
                    <button
                      type="button"
                      onClick={() => toggle('crm:prospects')}
                      className="flex w-full items-center gap-2 py-2 pl-9 pr-3 text-left transition-colors hover:bg-[#191E1E]"
                    >
                      {expanded['crm:prospects'] ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#A1A9A9]" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#A1A9A9]" />}
                      <Folder className="h-3.5 w-3.5 shrink-0 text-[#A0E7EC]" />
                      <span className="flex-1 truncate text-sm font-medium text-white">Prospects</span>
                      <span className="shrink-0 rounded-full bg-[#191E1E] px-1.5 py-0.5 text-[10px] font-bold text-[#A1A9A9]">{crm.totalProspects}</span>
                    </button>
                    {expanded['crm:prospects'] &&
                      (crm.prospectOffers.length === 0 ? (
                        <p className="py-2 pl-14 pr-3 text-xs text-[#A1A9A9]">Aucun client gagné</p>
                      ) : (
                        crm.prospectOffers.map((g) => {
                          const okey = `crm:offer:${g.offerId ?? 'none'}`;
                          return (
                            <div key={okey}>
                              <button
                                type="button"
                                onClick={() => toggle(okey)}
                                className="flex w-full items-center gap-2 py-2 pl-14 pr-3 text-left transition-colors hover:bg-[#191E1E]"
                              >
                                {expanded[okey] ? <ChevronDown className="h-3 w-3 shrink-0 text-[#A1A9A9]" /> : <ChevronRight className="h-3 w-3 shrink-0 text-[#A1A9A9]" />}
                                <Tag className="h-3 w-3 shrink-0 text-[#A1A9A9]" />
                                <span className="flex-1 truncate text-sm text-white">{g.offerName}</span>
                                <span className="shrink-0 rounded-full bg-[#191E1E] px-1.5 py-0.5 text-[10px] font-bold text-[#A1A9A9]">{g.people.length}</span>
                              </button>
                              {expanded[okey] && g.people.map((p) => CrmPersonBtn(p, 'pl-[4.75rem]'))}
                            </div>
                          );
                        })
                      ))}

                    {/* Équipe */}
                    {crm.showTeam && (
                      <>
                        <button
                          type="button"
                          onClick={() => toggle('crm:team')}
                          className="flex w-full items-center gap-2 py-2 pl-9 pr-3 text-left transition-colors hover:bg-[#191E1E]"
                        >
                          {expanded['crm:team'] ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#A1A9A9]" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#A1A9A9]" />}
                          <Users className="h-3.5 w-3.5 shrink-0 text-[#A0E7EC]" />
                          <span className="flex-1 truncate text-sm font-medium text-white">Équipe</span>
                          <span className="shrink-0 rounded-full bg-[#191E1E] px-1.5 py-0.5 text-[10px] font-bold text-[#A1A9A9]">{crm.team.length}</span>
                        </button>
                        {expanded['crm:team'] &&
                          (crm.team.length === 0 ? (
                            <p className="py-2 pl-14 pr-3 text-xs text-[#A1A9A9]">Aucun membre</p>
                          ) : (
                            crm.team.map((p) => CrmPersonBtn(p, 'pl-14'))
                          ))}
                      </>
                    )}
                  </div>
                )}
              </li>
            )}
            {!searching && crmLoading && !crm && (
              <li className="flex items-center gap-2 px-3 py-2 text-xs text-[#A1A9A9]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement du CRM…
              </li>
            )}

            {/* ===== Résultats CRM en recherche ===== */}
            {searching && crmMatches.length > 0 && (
              <>
                <li className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-[#CEFF8F]">CRM CloseOS</li>
                {crmMatches.map((p) => CrmPersonBtn(p, 'pl-3'))}
                <li className="my-1 border-t border-[#3A4242]" />
              </>
            )}

            {/* ===== Dossiers manuels (repliés) — masqués pendant la recherche ===== */}
            {!searching &&
              groups.map((g) => {
                const items = contacts.filter((c) => c.groupId === g.id);
                const isOpen = openGroups[g.id];
                return (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => setOpenGroups((p) => ({ ...p, [g.id]: !p[g.id] }))}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[#191E1E]"
                    >
                      {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#A1A9A9]" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#A1A9A9]" />}
                      <Folder className="h-3.5 w-3.5 shrink-0 text-[#CEFF8F]" />
                      <span className="flex-1 truncate text-sm font-medium text-white">{g.name}</span>
                      <span className="shrink-0 rounded-full bg-[#191E1E] px-1.5 py-0.5 text-[10px] font-bold text-[#A1A9A9]">{items.length}</span>
                    </button>
                    {isOpen && (items.length > 0 ? items.map((c) => ContactBtn(c, true)) : <p className="py-2 pl-9 pr-3 text-xs text-[#A1A9A9]">Dossier vide</p>)}
                  </li>
                );
              })}

            {/* Séparateur avant les non-classés (s'il y a des dossiers) */}
            {!searching && groups.length > 0 && ungrouped.length > 0 && (
              <li className="border-t border-[#3A4242] px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">Sans dossier</li>
            )}

            {(searching ? filtered : ungrouped).map((c) => (
              <li key={c.id}>{ContactBtn(c)}</li>
            ))}

            {filtered.length === 0 && crmMatches.length === 0 && <li className="px-3 py-3 text-center text-xs text-[#A1A9A9]">Aucun contact</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
