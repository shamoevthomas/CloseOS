import { formatDateFR } from './signFieldsMeta';

/** Champs posés "inline" (chips `.sign-field` dans content_html). Remplissables au remplissage/signature. */
export type InlineField = { fid: string; type: string; role: 'owner' | 'signer'; signerIndex: number; label: string };

/** Index du signataire d'un chip (`data-signer`, défaut 1). */
export const chipSignerIndex = (el: Element): number => {
  const n = parseInt(el.getAttribute('data-signer') || '1', 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
};

// Signature non gérée en inline (utiliser un champ libre) ; tout le reste est remplissable.
const NON_FILLABLE = new Set(['signature', 'initials']);
export const isInlineFillable = (type: string) => !NON_FILLABLE.has(type);

/** Identifiant stable d'un chip = sa position parmi tous les `.sign-field` (contenu verrouillé). */
export const chipFid = (index: number) => `i${index}`;

/** Liste des champs inline remplissables (fid = position) d'un content_html. */
export function parseInlineFields(html: string): InlineField[] {
  if (typeof window === 'undefined' || !html) return [];
  const doc = new DOMParser().parseFromString(`<div id="r">${html}</div>`, 'text/html');
  const out: InlineField[] = [];
  doc.getElementById('r')!.querySelectorAll('.sign-field').forEach((el, idx) => {
    const type = el.getAttribute('data-field') || 'text';
    if (!isInlineFillable(type)) return;
    out.push({
      fid: chipFid(idx),
      type,
      role: (el.getAttribute('data-role') as 'owner' | 'signer') || 'signer',
      signerIndex: chipSignerIndex(el),
      label: el.textContent?.trim() || type,
    });
  });
  return out;
}

export function formatInline(type: string, v: string): string {
  return type === 'date' && v ? formatDateFR(v) : v;
}
