import { useState } from 'react';
import { Plus, Pipette } from 'lucide-react';
import { COLOR_PALETTE } from '../lib/colorUtils';
import ColorPicker from './ColorPicker';

/** Palette de couleurs (DA Sign) : grille de teintes + section Personnalisé (sélecteur + pipette). */
export default function ColorPalette({
  onPick,
  extraTop,
}: {
  onPick: (hex: string) => void;
  extraTop?: React.ReactNode;
}) {
  const [picker, setPicker] = useState(false);

  const eyedrop = async () => {
    const ED = (window as any).EyeDropper;
    if (!ED) {
      setPicker(true);
      return;
    }
    try {
      const res = await new ED().open();
      if (res?.sRGBHex) onPick(res.sRGBHex);
    } catch {
      /* annulé */
    }
  };

  return (
    <div className="w-[244px]">
      {extraTop}
      <div className="flex flex-col gap-1">
        {COLOR_PALETTE.map((row, ri) => (
          <div key={ri} className="flex gap-1">
            {row.map((c) => (
              <button
                key={c + ri}
                type="button"
                onClick={() => onPick(c)}
                title={c}
                className="h-[18px] w-[18px] rounded-full border border-black/10 transition-transform hover:scale-110"
                style={{ background: c }}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="mt-3 text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">Personnalisé</div>
      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPicker(true)}
          title="Couleur personnalisée"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-[#3A4242] text-[#A1A9A9] transition-colors hover:border-[#CEFF8F] hover:text-[#CEFF8F]"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={eyedrop}
          title="Pipette"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-[#3A4242] text-[#A1A9A9] transition-colors hover:border-[#CEFF8F] hover:text-[#CEFF8F]"
        >
          <Pipette className="h-4 w-4" />
        </button>
      </div>

      {picker && (
        <ColorPicker
          value="#ff0000"
          onCancel={() => setPicker(false)}
          onValidate={(hex) => {
            setPicker(false);
            onPick(hex);
          }}
        />
      )}
    </div>
  );
}
