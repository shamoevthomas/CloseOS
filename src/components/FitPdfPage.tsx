import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Enveloppe d'aperçu PDF qui « tient dans l'écran ».
 * La page PDF est rendue à largeur fixe (≈ 794px) ; sur un écran plus étroit
 * (mobile), on la met à l'échelle via transform pour qu'elle rentre sans
 * débordement horizontal, tout en gardant les overlays (champs, images) alignés
 * puisqu'on scale tout le conteneur d'un bloc. La boîte extérieure prend la
 * taille réduite pour que la mise en page (hauteur) suive le scale.
 *
 * À utiliser pour les aperçus en lecture/remplissage (pas l'éditeur drag & drop,
 * dont les calculs de coordonnées supposent une échelle 1:1).
 */
export function FitPdfPage({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children?: ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / width));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={wrapRef} className="w-full" style={{ maxWidth: width }}>
      <div style={{ width: width * scale, height: height * scale }}>
        <div
          className="relative bg-white shadow-2xl"
          style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
