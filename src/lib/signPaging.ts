/**
 * Pagination A4 partagée (éditeur + vue validée/remplissage + page signataire + PDF).
 * Garantit des coordonnées de champs IDENTIQUES dans toutes les vues : le contenu est
 * « poussé » sur la feuille suivante via des espaceurs `.pg-break` (mêmes calculs partout).
 * Géométrie en px CSS @96dpi.
 */
import { signChipCss } from './signColors';
export const PX_PER_MM = 96 / 25.4;
export const PG_H = Math.round(297 * PX_PER_MM); // hauteur A4 ≈ 1123
export const PG_MARGIN = Math.round(25 * PX_PER_MM); // marge haute/basse ≈ 94
export const PG_GAP = 0; // feuilles bord à bord (coordonnées continues) ; séparateur = bande visuelle

/**
 * Insère les sauts de page dans `el` (enfants top-niveau) : un bloc qui déborde la page
 * courante est poussé en haut de la suivante (jamais coupé). Retourne le nombre de feuilles.
 */
export function paginateEl(el: HTMLElement): number {
  el.querySelectorAll('.pg-break').forEach((n) => n.remove());
  const blocks = Array.from(el.children) as HTMLElement[];
  let page = 0;
  for (const b of blocks) {
    if (b.classList?.contains('pg-break')) continue;
    const contentBottom = page * (PG_H + PG_GAP) + (PG_H - PG_MARGIN);
    const pageTop = page * (PG_H + PG_GAP) + PG_MARGIN;
    if (b.offsetTop + b.offsetHeight > contentBottom + 1 && b.offsetTop > pageTop + 2) {
      const nextTop = (page + 1) * (PG_H + PG_GAP) + PG_MARGIN;
      const sp = document.createElement('div');
      sp.className = 'pg-break';
      sp.setAttribute('contenteditable', 'false');
      sp.style.height = `${Math.max(0, Math.round(nextTop - b.offsetTop))}px`;
      sp.style.width = '100%';
      sp.style.pointerEvents = 'none';
      sp.style.userSelect = 'none';
      el.insertBefore(sp, b);
      page++;
    }
  }
  return page + 1;
}

/** CSS des feuilles A4 empilées (à inclure dans le <style> de chaque vue). */
export const PAGED_CSS = `
.pg-stack { position:relative; width:210mm; margin:0 auto; }
.pg-sheet { position:absolute; left:0; right:0; background:#fff; box-shadow:0 10px 50px rgba(0,0,0,.5); border-radius:1px; }
.pg-num { position:absolute; right:22mm; bottom:9mm; font-family:"SF Pro Display",Arial,sans-serif; font-size:10px; color:#b0b6b6; letter-spacing:.04em; }
.pg-divider { position:absolute; left:-30px; right:-30px; height:28px; z-index:6; pointer-events:none; background:#191E1E;
  box-shadow: inset 0 16px 16px -16px rgba(0,0,0,.55), inset 0 -16px 16px -16px rgba(0,0,0,.55); }
.pg-doc { position:relative; z-index:10; background:transparent; padding:25mm 22mm; box-sizing:border-box; min-height:auto; }
.pg-doc:focus { outline:none; }
.pg-break { width:100%; pointer-events:none; user-select:none; }
/* Slots inline : LARGEUR FIXE par type (la mise en page ne reflue pas quand on remplit).
   Lecture = <span class="sign-field"> ; édition = <input class="sf-inline-input"> (vrai champ React). */
.sign-field[data-field], .sf-inline-input[data-field] { display:inline-block; vertical-align:bottom; box-sizing:border-box; }
.sign-field[data-field] { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
[data-field="name"] { width:170px; }
[data-field="email"] { width:190px; }
[data-field="tel"] { width:150px; }
[data-field="address"] { width:280px; }
[data-field="city"] { width:160px; }
[data-field="siret"] { width:150px; }
[data-field="siren"] { width:130px; }
[data-field="tva"] { width:170px; }
[data-field="company_id"] { width:180px; }
[data-field="ape"] { width:120px; }
[data-field="date"] { width:120px; }
[data-field="time"] { width:90px; }
[data-field="text"] { width:160px; }
.sign-field[data-field="signature"], .sign-field[data-field="initials"], .sign-field[data-field="checkbox"] { width:auto; max-width:100%; white-space:normal; }
/* champ inline éditable = input propre teinté (couleur selon le rôle), texte noir */
.sf-inline-input { border:none; outline:none; padding:1px 6px; font:inherit; color:#1a1a1a; letter-spacing:normal;
  background:rgba(206,255,143,.22); border-radius:4px; }
.sf-inline-input[data-role="owner"] { background:rgba(160,231,236,.24); }
.sf-inline-input:focus { background:rgba(206,255,143,.34); box-shadow:0 0 0 2px rgba(206,255,143,.55); }
.sf-inline-input[data-role="owner"]:focus { background:rgba(160,231,236,.36); box-shadow:0 0 0 2px rgba(160,231,236,.6); }
.sf-inline-input::placeholder { color:#8a8a8a; text-transform:none; opacity:1; }
.sf-inline-date { text-align:left; cursor:pointer; line-height:1.4; }
/* chip lecture seule : rempli = texte simple ; vide = placeholder (libellé) */
.sign-field[data-field][data-ph]:empty::before { content:attr(data-ph); opacity:.55; }
/* Champ rempli (lecture) : redevient du texte normal, ENTIÈREMENT visible.
   Plus de troncature/ellipse : la largeur s'adapte au contenu (élargit) puis passe à la ligne
   si nécessaire (jusqu'à la largeur de page). Pas d'arrondi -> rien n'est rogné dans le PDF. */
.sign-field[data-field].sf-filled { border:none; background:transparent; color:#1a1a1a; padding:0 2px; text-transform:none; font-weight:inherit; font-size:inherit; letter-spacing:normal;
  width:auto; max-width:100%; white-space:normal; overflow:visible; text-overflow:clip; overflow-wrap:anywhere; word-break:break-word; border-radius:0; box-shadow:none; }
.sign-field[data-field].sf-filled::before { content:none; }
${signChipCss()}
`;
