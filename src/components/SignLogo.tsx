/**
 * CloseOS Sign — marque officielle (logo de référence).
 * Image fournie dans /public : picto « CO » (anneau lime + anneau gris) + mot-symbole
 * « CloseOS » (Close blanc, OS lime) et « Sign » en italique lime.
 *
 * La marque suit la taille de police du conteneur : on la dimensionne via la taille
 * de texte passée dans `className` (ex. `text-lg`) — la hauteur est en `em`.
 */

const LOGO_SRC = '/CLOSEOS-SIGN-LOGO.png';

interface SignLogoProps {
  className?: string;
  /** Atténué (zones secondaires : footer…). */
  muted?: boolean;
}

/** Logo complet : picto + mot-symbole « CloseOS Sign ». */
export function SignLogo({ className = '', muted = false }: SignLogoProps) {
  return (
    <img
      src={LOGO_SRC}
      alt="CloseOS Sign"
      className={`inline-block w-auto select-none ${className}`}
      style={{ height: '1.7em', opacity: muted ? 0.7 : 1 }}
      draggable={false}
    />
  );
}
