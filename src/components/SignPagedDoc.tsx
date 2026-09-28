import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PG_H, PG_GAP, PX_PER_MM } from '../lib/signPaging';

/** Largeur réelle d'une feuille A4 (210 mm), celle de `.pg-stack`. */
const SHEET_W = 210 * PX_PER_MM;
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

  // Mise à l'échelle sur écran étroit : la feuille garde sa largeur A4 réelle (coordonnées des champs
  // et capture PDF inchangées : la capture clone `.pg-stack` hors de cette enveloppe) et c'est
  // l'enveloppe qui la réduit pour tenir dans la largeur, sans rognage ni défilement horizontal.
  const fitRef = useRef<HTMLDivElement | null>(null);
  const stackRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [stackH, setStackH] = useState(() => pages * (PG_H + PG_GAP) - PG_GAP);
  useLayoutEffect(() => {
    const fit = fitRef.current;
    const stack = stackRef.current;
    if (!fit || !stack) return;
    const update = () => {
      setScale(Math.min(1, fit.clientWidth / SHEET_W));
      setStackH(Math.max(stack.offsetHeight, stack.scrollHeight));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(fit);
    ro.observe(stack);
    if (localRef.current) ro.observe(localRef.current);
    return () => ro.disconnect();
  }, []);
  // Le nombre de feuilles peut changer après la mesure (pagination différée) : on réajuste la hauteur
  // de l'enveloppe, sinon le bas de la dernière page déborderait et ne serait plus atteignable.
  useLayoutEffect(() => {
    if (stackRef.current) setStackH(Math.max(stackRef.current.offsetHeight, pages * (PG_H + PG_GAP) - PG_GAP));
  }, [pages]);
  const setStackRef = (node: HTMLDivElement | null) => {
    stackRef.current = node;
    if (docElRef) docElRef.current = node;
  };

  return (
    <div ref={fitRef} className="mx-auto w-full" style={{ maxWidth: SHEET_W, overflowX: scale < 1 ? 'clip' : undefined }}>
    <div style={{ width: SHEET_W * scale, height: stackH * scale }}>
    <div data-sign-fit={scale} style={{ width: SHEET_W, transform: scale < 1 ? `scale(${scale})` : undefined, transformOrigin: 'top left' }}>
    <div className="pg-stack" ref={setStackRef} style={{ minHeight: pages * (PG_H + PG_GAP) - PG_GAP }}>
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
    </div>
    </div>
  );
}
