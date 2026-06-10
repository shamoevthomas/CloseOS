import { useRef, useState } from 'react';
import { hexToRgb, hsvToHex, hsvToRgb, rgbToHsv, clamp } from '../lib/colorUtils';

/** Sélecteur de couleur personnalisé (DA Sign) : carré S/V, curseur de teinte, hex + RGB. */
export default function ColorPicker({
  value,
  onValidate,
  onCancel,
}: {
  value: string;
  onValidate: (hex: string) => void;
  onCancel: () => void;
}) {
  const init = (() => {
    const rgb = hexToRgb(value) ?? { r: 255, g: 0, b: 0 };
    return rgbToHsv(rgb.r, rgb.g, rgb.b);
  })();
  const [h, setH] = useState(init.h);
  const [s, setS] = useState(init.s);
  const [v, setV] = useState(init.v);
  const [hexText, setHexText] = useState(value);
  const squareRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  const hex = hsvToHex(h, s, v);
  const rgb = hsvToRgb(h, s, v);
  const R = Math.round(rgb.r);
  const G = Math.round(rgb.g);
  const B = Math.round(rgb.b);

  const syncHexFromHsv = () => setHexText(hsvToHex(h, s, v));

  const updateSV = (e: React.PointerEvent) => {
    const el = squareRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const ns = clamp((e.clientX - r.left) / r.width, 0, 1);
    const nv = clamp(1 - (e.clientY - r.top) / r.height, 0, 1);
    setS(ns);
    setV(nv);
    setHexText(hsvToHex(h, ns, nv));
  };
  const updateHue = (e: React.PointerEvent) => {
    const el = hueRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const nh = clamp((e.clientX - r.left) / r.width, 0, 1) * 360;
    setH(nh);
    setHexText(hsvToHex(nh, s, v));
  };

  const onHex = (txt: string) => {
    setHexText(txt);
    const rgb2 = hexToRgb(txt);
    if (rgb2) {
      const hsv = rgbToHsv(rgb2.r, rgb2.g, rgb2.b);
      setH(hsv.h);
      setS(hsv.s);
      setV(hsv.v);
    }
  };
  const onRgb = (nr: number, ng: number, nb: number) => {
    const hsv = rgbToHsv(clamp(nr, 0, 255), clamp(ng, 0, 255), clamp(nb, 0, 255));
    setH(hsv.h);
    setS(hsv.s);
    setV(hsv.v);
    setHexText(hsvToHex(hsv.h, hsv.s, hsv.v));
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" onMouseDown={(e) => e.stopPropagation()}>
      <div className="w-full max-w-sm rounded-xl border border-[#3A4242] bg-[#222828] p-5 shadow-2xl">
        {/* Carré saturation / valeur */}
        <div
          ref={squareRef}
          onPointerDown={(e) => {
            (e.currentTarget as Element).setPointerCapture(e.pointerId);
            updateSV(e);
          }}
          onPointerMove={(e) => {
            if (e.buttons === 1) updateSV(e);
          }}
          className="relative h-44 w-full cursor-crosshair rounded-lg"
          style={{
            backgroundColor: `hsl(${h},100%,50%)`,
            backgroundImage: 'linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, rgba(255,255,255,0))',
          }}
        >
          <span
            className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
            style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%`, background: hex }}
          />
        </div>

        {/* Curseur de teinte */}
        <div
          ref={hueRef}
          onPointerDown={(e) => {
            (e.currentTarget as Element).setPointerCapture(e.pointerId);
            updateHue(e);
          }}
          onPointerMove={(e) => {
            if (e.buttons === 1) updateHue(e);
          }}
          className="relative mt-4 h-4 w-full cursor-pointer rounded-full"
          style={{ background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)' }}
        >
          <span
            className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
            style={{ left: `${(h / 360) * 100}%`, background: `hsl(${h},100%,50%)` }}
          />
        </div>

        {/* Aperçu + hex + RGB */}
        <div className="mt-4 flex items-end gap-3">
          <div className="h-10 w-10 shrink-0 rounded-full border border-[#3A4242]" style={{ background: hex }} />
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">Hex</label>
            <input
              value={hexText}
              onChange={(e) => onHex(e.target.value)}
              onBlur={syncHexFromHsv}
              className="w-full rounded border border-[#3A4242] bg-[#191E1E] px-2 py-1.5 text-sm text-white outline-none focus:border-[#CEFF8F]"
            />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(
            [
              ['R', R, (n: number) => onRgb(n, G, B)],
              ['V', G, (n: number) => onRgb(R, n, B)],
              ['B', B, (n: number) => onRgb(R, G, n)],
            ] as const
          ).map(([label, val, set]) => (
            <div key={label}>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">{label}</label>
              <input
                type="number"
                min={0}
                max={255}
                value={val}
                onChange={(e) => set(Number(e.target.value))}
                className="w-full rounded border border-[#3A4242] bg-[#191E1E] px-2 py-1.5 text-sm text-white outline-none focus:border-[#CEFF8F]"
              />
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onCancel} className="rounded border border-[#3A4242] px-4 py-2 text-sm font-medium text-[#A1A9A9] transition-colors hover:border-[#A1A9A9] hover:text-white">
            Annuler
          </button>
          <button onClick={() => onValidate(hex)} className="rounded bg-[#CEFF8F] px-5 py-2 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC]">
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
