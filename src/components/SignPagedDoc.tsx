import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PG_H, PG_GAP } from '../lib/signPaging';
import { htmlToReact, countPages, InlineProvider } from '../lib/signHtmlToReact';
import { ROLE_COLOR, todayLocalISO } from '../lib/signFieldsMeta';
import DatePickerModal from './DatePickerModal';

/**
 * Rendu d'un document texte en feuilles A4 empilées (lecture seule / remplissage).
 * Le document est rendu en ARBRE REACT (pas de dangerouslySetInnerHTML) : les chips de champ
 * deviennent de vrais <input> React contrôlés → focus/curseur natifs, jamais de désélection,
 * et la valeur (`value`) affiche le préremplissage. Pagination = sauts de page `.pg-break`
 * bakés dans le html (rendus comme des espaceurs) ; sinon mesure de la hauteur.
 */
export default function SignPagedDoc({
  html,
  docClass,
  docElRef,
  inlineValues,
  inlineRole = null,
  inlineSignerIndex = null,
  onInlineChange,
  children,
}: {
  html: string;
  docClass: string;
  docElRef?: React.MutableRefObject<HTMLDivElement | null>;
  inlineValues?: Record<string, string>;
  inlineRole?: 'owner' | 'signer' | null;
  inlineSignerIndex?: number | null;
  onInlineChange?: (fid: string, value: string) => void;
  inlineResetKey?: number;
  children?: React.ReactNode;
}) {
  const localRef = useRef<HTMLDivElement | null>(null);
  const [pages, setPages] = useState(() => countPages(html));
  const [datePick, setDatePick] = useState<{ fid: string; value: string } | null>(null);
  const tree = useMemo(() => htmlToReact(html), [html]);
  const frozen = useMemo(() => /class="pg-break"/.test(html), [html]);

  useLayoutEffect(() => {
    if (frozen) {
      setPages(countPages(html));
      return;
    }
    // Document non figé (pas de sauts bakés) : on déduit le nb de feuilles de la hauteur réelle
    const el = localRef.current;
    if (!el) return;
    const measure = () => setPages(Math.max(1, Math.round(el.scrollHeight / PG_H)));
    measure();
    const t = setTimeout(measure, 250);
    return () => clearTimeout(t);
  }, [html, frozen]);

  // localRef = .pg-doc (mesure pagination). docElRef = .pg-stack (capture PDF incluant les overlays de champs).
  const setRefs = (node: HTMLDivElement | null) => {
    localRef.current = node;
  };

  return (
    <div className="max-w-full overflow-x-auto">
    <div className="pg-stack" ref={docElRef} style={{ minHeight: pages * (PG_H + PG_GAP) - PG_GAP }}>
      {Array.from({ length: pages }).map((_, k) => (
        <div key={`s${k}`} className="pg-sheet" style={{ top: k * (PG_H + PG_GAP), height: PG_H }}>
          <span className="pg-num">
            Page {k + 1} / {pages}
          </span>
        </div>
      ))}
      {Array.from({ length: Math.max(0, pages - 1) }).map((_, k) => (
        <div key={`d${k}`} className="pg-divider" style={{ top: (k + 1) * (PG_H + PG_GAP) - 14 }} />
      ))}
      <div ref={setRefs} className={`${docClass} pg-doc`}>
        <InlineProvider
          value={{
            inlineValues,
            inlineRole,
            inlineSignerIndex,
            onInlineChange,
            openDatePicker: (fid, current) => setDatePick({ fid, value: current || todayLocalISO() }),
          }}
        >
          {tree}
        </InlineProvider>
      </div>
      {children}
      <DatePickerModal
        open={!!datePick}
        value={datePick?.value}
        accent={inlineRole === 'owner' ? ROLE_COLOR.owner : ROLE_COLOR.signer}
        onClose={() => setDatePick(null)}
        onConfirm={(iso) => {
          if (datePick) onInlineChange?.(datePick.fid, iso);
          setDatePick(null);
        }}
      />
    </div>
    </div>
  );
}
