import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search, UserCheck } from 'lucide-react';
import type { SignContact } from '../lib/signContracts';

/** Sélecteur de contact avec barre de recherche (DA Sign). */
export default function ContactPicker({
  contacts,
  onSelect,
}: {
  contacts: SignContact[];
  onSelect: (c: SignContact) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const filtered = contacts.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${c.name} ${c.email}`.toLowerCase().includes(q);
  });

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
          <ul className="max-h-60 overflow-y-auto py-1">
            {filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(c);
                    setPicked(c.name || c.email);
                    setOpen(false);
                    setSearch('');
                  }}
                  className="flex w-full flex-col items-start px-3 py-2 text-left transition-colors hover:bg-[#191E1E]"
                >
                  <span className="truncate text-sm text-white">{c.name || c.email}</span>
                  {c.name && <span className="truncate text-xs text-[#A1A9A9]">{c.email}</span>}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-3 text-center text-xs text-[#A1A9A9]">Aucun contact</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
