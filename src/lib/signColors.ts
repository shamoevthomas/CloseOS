/**
 * Couleurs par partie (multi-signataire).
 * - Signataire 1 = lime (#CEFF8F), l'accent « signataire » par défaut.
 * - Signataires suivants : palette distincte.
 * - Propriétaire = menthe (#A0E7EC).
 * Utilisé pour colorer les champs (overlays + chips inline) dans l'éditeur, la page
 * signataire et le PDF, afin de distinguer à qui appartient chaque champ.
 */
export const OWNER_COLOR = '#A0E7EC';
export const SIGNER_COLORS = ['#CEFF8F', '#F0B86E', '#C9A8FF', '#F9A8D4', '#7DD3FC', '#FCD34D', '#FCA5A5', '#86EFAC'];
export const MAX_SIGNERS = 10;

/** Couleur d'un signataire 1..N (boucle sur la palette au-delà). */
export function signerColor(index: number): string {
  const i = Math.max(1, Math.floor(index || 1));
  return SIGNER_COLORS[(i - 1) % SIGNER_COLORS.length];
}

/** Couleur d'un champ selon rôle + index signataire. */
export function fieldColor(role: 'owner' | 'signer', signerIndex?: number | null): string {
  return role === 'owner' ? OWNER_COLOR : signerColor(signerIndex ?? 1);
}

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/**
 * CSS des chips/inputs colorés par `data-signer` (à injecter dans le <style> des vues).
 * Le signataire 1 reprend le lime par défaut ; les suivants ont leur propre couleur.
 * Le propriétaire reste géré par les règles `[data-role="owner"]` existantes.
 */
export function signChipCss(): string {
  let css = '';
  for (let k = 1; k <= MAX_SIGNERS; k++) {
    const c = signerColor(k);
    css += `.sign-field[data-signer="${k}"]{border-color:${c};color:${c};}`;
    css += `.sf-inline-input[data-signer="${k}"]{background:${hexToRgba(c, 0.22)};}`;
    css += `.sf-inline-input[data-signer="${k}"]:focus{background:${hexToRgba(c, 0.34)};box-shadow:0 0 0 2px ${hexToRgba(c, 0.55)};}`;
  }
  return css;
}
