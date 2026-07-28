import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';
import { COUNTRY_CODES, flagOf } from '../lib/countryCodes';
import { AsYouType, getExampleNumber, type CountryCode } from 'libphonenumber-js';
import examples from 'libphonenumber-js/examples.mobile.json';

/** Formate le numéro NATIONAL (sans indicatif) avec les espaces du pays, déduit du dial. */
function formatNational(digits: string, dial: string): string {
  if (!digits) return '';
  try {
    const intl = new AsYouType().input(`${dial}${digits}`); // ex. "+33 6 12 34 56 78"
    return intl.startsWith(dial) ? intl.slice(dial.length).trimStart() : digits;
  } catch {
    return digits;
  }
}

/**
 * Champ téléphone avec sélecteur d'indicatif international (recherchable).
 * Émet la valeur combinée "indicatif numéro" (ex. "+33 6 12 34 56 78"), ou '' si vide.
 * Le menu déroulant est rendu dans un PORTAL (body, position fixed) pour ne pas être coupé
 * par l'overflow / z-index d'un modal parent (ex. pop-up de vérification).
 */
export default function PhoneInput({
  value,
  onChange,
  defaultIso = 'FR',
  placeholder,
  variant = 'dark',
  fontSize,
}: {
  value: string;
  onChange: (v: string) => void;
  defaultIso?: string;
  placeholder?: string;
  variant?: 'dark' | 'plain' | 'sales';
  fontSize?: number;
}) {
  const plain = variant === 'plain';
  const sales = variant === 'sales';
  const [iso, setIso] = useState(defaultIso);
  const [num, setNum] = useState('');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const country = COUNTRY_CODES.find((c) => c.iso === iso) ?? COUNTRY_CODES.find((c) => c.iso === 'FR')!;

  // Exemple de numéro dynamique selon le pays sélectionné (formaté comme la saisie réelle)
  const examplePlaceholder = useMemo(() => {
    if (placeholder) return placeholder; // placeholder explicite prioritaire
    try {
      const ex = getExampleNumber(country.iso as CountryCode, examples as any);
      if (ex) return formatNational(ex.nationalNumber, country.dial);
    } catch { /* pays sans exemple → fallback */ }
    return '6 12 34 56 78';
  }, [placeholder, country.iso, country.dial]);

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
      setNum(formatNational(v.slice(match.dial.length).replace(/\D/g, ''), match.dial));
    } else {
      setNum(v);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Positionne le menu sous le bouton (fixed), et le suit au scroll/resize.
  useLayoutEffect(() => {
    if (!open) return;
    const reposition = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = 288; // w-72
      let left = r.left;
      if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
      if (left < 8) left = 8;
      setPos({ top: r.bottom + 4, left, width });
    };
    reposition();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open]);

  // Fermeture au clic extérieur (le menu est dans un portal → on teste root ET menu)
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || dropRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const emit = (dial: string, n: string) => onChange(n.trim() ? `${dial} ${n.trim()}` : '');

  const pick = (nextIso: string, dial: string) => {
    setIso(nextIso);
    setOpen(false);
    setSearch('');
    const formatted = formatNational(num.replace(/\D/g, ''), dial);
    setNum(formatted);
    emit(dial, formatted);
  };

  const filtered = COUNTRY_CODES.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.iso.toLowerCase().includes(q);
  });

  return (
    <div ref={rootRef} className={
      sales
        ? 'relative flex h-full w-full items-center gap-1 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-2.5 py-2 transition-colors focus-within:border-sky-500'
        : plain ? 'relative flex h-full w-full items-center' : 'relative flex gap-2'
    }>
      {/* Sélecteur d'indicatif */}
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={plain && fontSize ? { fontSize } : undefined}
        className={
          sales
            ? 'flex shrink-0 items-center gap-1 pr-1.5 text-sm text-slate-900 dark:text-white outline-none'
            : plain
            ? 'flex shrink-0 items-center gap-1 px-1.5 text-[#1a1a1a] outline-none'
            : 'flex shrink-0 items-center gap-1.5 rounded border border-[#3A4242] bg-[#191E1E] px-3 py-2.5 text-sm text-white outline-none transition-colors hover:border-[#A1A9A9]'
        }
      >
        <span className="leading-none" style={{ fontSize: plain && fontSize ? fontSize : 16 }}>{flagOf(country.iso)}</span>
        <span className={sales ? 'text-slate-900 dark:text-white' : plain ? 'text-[#1a1a1a]' : 'text-[#F3F4F6]'}>{country.dial}</span>
        <ChevronDown className={sales ? 'h-3.5 w-3.5 text-slate-400' : 'h-3.5 w-3.5 text-[#A1A9A9]'} />
      </button>

      {/* Numéro */}
      <input
        type="tel"
        value={num}
        onChange={(e) => {
          const formatted = formatNational(e.target.value.replace(/\D/g, ''), country.dial);
          setNum(formatted);
          emit(country.dial, formatted);
        }}
        placeholder={examplePlaceholder}
        style={plain && fontSize ? { fontSize } : undefined}
        className={
          sales
            ? 'min-w-0 flex-1 bg-transparent px-1 text-sm text-slate-900 dark:text-white outline-none placeholder:text-slate-400 dark:placeholder:text-neutral-500'
            : plain
            ? 'min-w-0 flex-1 bg-transparent px-1 text-[#1a1a1a] outline-none placeholder:text-[#1a1a1a]/40'
            : 'min-w-0 flex-1 rounded border border-[#3A4242] bg-[#191E1E] px-4 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-[#A1A9A9]/40 focus:border-[#CEFF8F]'
        }
      />

      {/* Dropdown — portal (échappe à l'overflow/z-index du modal) */}
      {open && pos && createPortal(
        <div
          ref={dropRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
          className={sales
            ? 'overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] shadow-2xl'
            : 'overflow-hidden rounded-lg border border-[#3A4242] bg-[#222828] shadow-2xl'}
        >
          <div className={sales ? 'relative border-b border-slate-200 dark:border-white/10 p-2' : 'relative border-b border-[#3A4242] p-2'}>
            <Search className={sales ? 'pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400' : 'pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#A1A9A9]'} />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un pays / indicatif…"
              className={sales
                ? 'w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 py-2 pl-8 pr-3 text-sm text-slate-900 dark:text-white outline-none placeholder:text-slate-400 focus:border-sky-500'
                : 'w-full rounded border border-[#3A4242] bg-[#191E1E] py-2 pl-8 pr-3 text-sm text-white outline-none placeholder:text-[#A1A9A9]/50 focus:border-[#CEFF8F]'}
            />
          </div>
          <ul className="max-h-60 overflow-y-auto py-1">
            {filtered.map((c) => (
              <li key={c.iso}>
                <button
                  type="button"
                  onClick={() => pick(c.iso, c.dial)}
                  className={sales
                    ? `flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-white/5 ${c.iso === iso ? 'text-sky-600 dark:text-sky-400' : 'text-slate-900 dark:text-white'}`
                    : `flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[#191E1E] ${c.iso === iso ? 'text-[#CEFF8F]' : 'text-[#F3F4F6]'}`}
                >
                  <span className="text-base leading-none">{flagOf(c.iso)}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className={sales ? 'text-slate-400' : 'text-[#A1A9A9]'}>{c.dial}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className={sales ? 'px-3 py-3 text-center text-xs text-slate-400' : 'px-3 py-3 text-center text-xs text-[#A1A9A9]'}>Aucun résultat</li>}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  );
}
