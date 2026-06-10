import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Bouton de barre d'outils avec popover. Le popover préserve la sélection de
 * l'éditeur (preventDefault sur mousedown) → utilisé pour couleur / surlignage / taille.
 */
export default function ToolbarMenu({
  icon: Icon,
  title,
  btnClass,
  children,
}: {
  icon: any;
  title: string;
  btnClass: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        className={btnClass}
        title={title}
      >
        <Icon className="h-4 w-4" />
      </button>
      {open && (
        <div
          onMouseDown={(e) => e.preventDefault()}
          className="absolute left-0 top-full z-[70] mt-1 rounded-lg border border-[#3A4242] bg-[#222828] p-2 shadow-2xl"
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
