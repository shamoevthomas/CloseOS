import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { COUNTRY_CODES, flagOf } from '../lib/countryCodes';

/**
 * Champ téléphone avec sélecteur d'indicatif international (recherchable).
 * Émet la valeur combinée "indicatif numéro" (ex. "+33 6 12 34 56 78"), ou '' si vide.
 */
export default function PhoneInput({
  value,
  onChange,
  defaultIso = 'FR',
  placeholder = '6 12 34 56 78',
  variant = 'dark',
  fontSize,
}: {
  value: string;
  onChange: (v: string) => void;
  defaultIso?: string;
  placeholder?: string;
  variant?: 'dark' | 'plain';
  fontSize?: number;
}) {
  const plain = variant === 'plain';
  const [iso, setIso] = useState(defaultIso);
  const [num, setNum] = useState('');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const country = COUNTRY_CODES.find((c) => c.iso === iso) ?? COUNTRY_CODES.find((c) => c.iso === 'FR')!;

  // Réinitialise le numéro local si le parent vide la valeur
  useEffect(() => {
    if (!value) setNum('');
  }, [value]);

  // Au montage : parse une valeur pré-remplie ("+33 6 12 34 56 78") → indicatif + numéro
  useEffect(() => {
    const v = (value || '').trim();
    if (!v) return;
    const match = [...COUNTRY_CODES].sort((a, b) => b.dial.length - a.dial.length).find((c) => v.startsWith(c.dial));
    if (match) {
      setIso(match.iso);
      setNum(v.slice(match.dial.length).trim());
    } else {
      setNum(v);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fermeture au clic extérieur
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const emit = (dial: string, n: string) => onChange(n.trim() ? `${dial} ${n.trim()}` : '');

  const pick = (nextIso: string, dial: string) => {
    setIso(nextIso);
    setOpen(false);
    setSearch('');
    emit(dial, num);
  };

  const filtered = COUNTRY_CODES.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.iso.toLowerCase().includes(q);
  });

  return (
    <div ref={rootRef} className={plain ? 'relative flex h-full w-full items-center' : 'relative flex gap-2'}>
      {/* Sélecteur d'indicatif */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={plain && fontSize ? { fontSize } : undefined}
        className={
          plain
            ? 'flex shrink-0 items-center gap-1 px-1.5 text-[#1a1a1a] outline-none'
            : 'flex shrink-0 items-center gap-1.5 rounded border border-[#3A4242] bg-[#191E1E] px-3 py-2.5 text-sm text-white outline-none transition-colors hover:border-[#A1A9A9]'
        }
      >
        <span className="leading-none" style={{ fontSize: plain && fontSize ? fontSize : 16 }}>{flagOf(country.iso)}</span>
        <span className={plain ? 'text-[#1a1a1a]' : 'text-[#F3F4F6]'}>{country.dial}</span>
        <ChevronDown className="h-3.5 w-3.5 text-[#A1A9A9]" />
      </button>

      {/* Numéro */}
      <input
        type="tel"
        value={num}
        onChange={(e) => {
          setNum(e.target.value);
          emit(country.dial, e.target.value);
        }}
        placeholder={placeholder}
        style={plain && fontSize ? { fontSize } : undefined}
        className={
          plain
            ? 'min-w-0 flex-1 bg-transparent px-1 text-[#1a1a1a] outline-none placeholder:text-[#1a1a1a]/40'
            : 'min-w-0 flex-1 rounded border border-[#3A4242] bg-[#191E1E] px-4 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-[#A1A9A9]/40 focus:border-[#CEFF8F]'
        }
      />

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-lg border border-[#3A4242] bg-[#222828] shadow-2xl">
          <div className="relative border-b border-[#3A4242] p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#A1A9A9]" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un pays / indicatif…"
              className="w-full rounded border border-[#3A4242] bg-[#191E1E] py-2 pl-8 pr-3 text-sm text-white outline-none placeholder:text-[#A1A9A9]/50 focus:border-[#CEFF8F]"
            />
          </div>
          <ul className="max-h-60 overflow-y-auto py-1">
            {filtered.map((c) => (
              <li key={c.iso}>
                <button
                  type="button"
                  onClick={() => pick(c.iso, c.dial)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[#191E1E] ${
                    c.iso === iso ? 'text-[#CEFF8F]' : 'text-[#F3F4F6]'
                  }`}
                >
                  <span className="text-base leading-none">{flagOf(c.iso)}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-[#A1A9A9]">{c.dial}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="px-3 py-3 text-center text-xs text-[#A1A9A9]">Aucun résultat</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
