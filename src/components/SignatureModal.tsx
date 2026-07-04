import { useRef, useState, useEffect } from 'react';
import { X, PenTool, Upload, Type as TypeIcon, Eraser, ShieldCheck, ArrowLeft } from 'lucide-react';
import { computeInitials, cursiveTextToDataUrl, CURSIVE_FONT } from '../lib/signFieldsMeta';
import { useSignLang } from '../contexts/SignLangContext';

/**
 * Modale de signature (DA Sign). 3 modes : Initiales (Prénom+Nom → "T.S"),
 * Import d'image, Dessin. Étape de confirmation "êtes-vous sûr de vouloir signer ?".
 * onConfirm renvoie soit un texte (initiales) soit un data URL image.
 */

type Mode = 'initials' | 'import' | 'draw';

const CURSIVE = CURSIVE_FONT;

export default function SignatureModal({
  open,
  onClose,
  onConfirm,
  accent = '#CEFF8F',
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  accent?: string;
}) {
  const { lang } = useSignLang();
  const [mode, setMode] = useState<Mode>('initials');
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [imported, setImported] = useState('');
  const [hasDrawn, setHasDrawn] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);
  const [pending, setPending] = useState(''); // valeur figée avant confirmation (le canvas est démonté à l'étape confirm)
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    if (!open) {
      setMode('initials');
      setPrenom('');
      setNom('');
      setImported('');
      setHasDrawn(false);
      setConfirmStep(false);
      setPending('');
    }
  }, [open]);

  if (!open) return null;

  const initials = computeInitials(prenom, nom);

  const canvasPos = (e: React.PointerEvent) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };
  const startDraw = (e: React.PointerEvent) => {
    const c = canvasRef.current;
    if (!c) return;
    c.setPointerCapture(e.pointerId);
    const ctx = c.getContext('2d')!;
    drawing.current = true;
    const { x, y } = canvasPos(e);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const moveDraw = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = canvasPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasDrawn) setHasDrawn(true);
  };
  const endDraw = () => {
    drawing.current = false;
  };
  const clearCanvas = () => {
    const c = canvasRef.current;
    if (!c) return;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    setHasDrawn(false);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !f.type.startsWith('image/')) return;
    const fr = new FileReader();
    fr.onload = () => setImported(fr.result as string);
    fr.readAsDataURL(f);
  };

  const currentValue = (): string => {
    if (mode === 'initials') return initials;
    if (mode === 'import') return imported;
    if (mode === 'draw' && canvasRef.current && hasDrawn) return canvasRef.current.toDataURL('image/png');
    return '';
  };
  const canValidate = () => {
    if (mode === 'initials') return initials.length > 0;
    if (mode === 'import') return !!imported;
    return hasDrawn;
  };

  const tabBtn = (m: Mode, Icon: typeof PenTool, label: string) => (
    <button
      onClick={() => setMode(m)}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-semibold transition-colors ${
        mode === m ? '' : 'text-[#A1A9A9] hover:text-white'
      }`}
      style={mode === m ? { background: accent, color: '#191E1E' } : undefined}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-[#3A4242] bg-[#222828] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{confirmStep ? (lang === 'fr' ? 'Confirmer la signature' : 'Confirm signature') : (lang === 'fr' ? 'Votre signature' : 'Your signature')}</h3>
          <button onClick={onClose} className="text-[#A1A9A9] transition-colors hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {confirmStep ? (
          <div>
            <div className="mb-5 flex min-h-[120px] items-center justify-center rounded-lg border border-[#3A4242] bg-white p-4">
              <SignaturePreview value={pending} />
            </div>
            <p className="mb-6 text-center text-sm text-[#F3F4F6]">{lang === 'fr' ? 'Êtes-vous sûr de vouloir signer ?' : 'Are you sure you want to sign?'}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmStep(false)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded border border-[#3A4242] py-2.5 text-sm font-medium text-[#A1A9A9] transition-colors hover:border-[#A1A9A9] hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" /> {lang === 'fr' ? 'Retour' : 'Back'}
              </button>
              <button
                onClick={() => onConfirm(pending)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded py-2.5 text-sm font-bold text-[#191E1E]"
                style={{ background: accent }}
              >
                <ShieldCheck className="h-4 w-4" /> {lang === 'fr' ? 'Oui, je signe' : 'Yes, I sign'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-4 flex gap-1 rounded-lg border border-[#3A4242] bg-[#191E1E] p-1">
              {tabBtn('initials', TypeIcon, lang === 'fr' ? 'Initiales' : 'Initials')}
              {tabBtn('import', Upload, lang === 'fr' ? 'Importer' : 'Import')}
              {tabBtn('draw', PenTool, lang === 'fr' ? 'Dessiner' : 'Draw')}
            </div>

            {mode === 'initials' && (
              <div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">{lang === 'fr' ? 'Prénom' : 'First name'}</label>
                    <input
                      value={prenom}
                      onChange={(e) => setPrenom(e.target.value)}
                      placeholder="Thomas"
                      className="w-full rounded border border-[#3A4242] bg-[#191E1E] px-3 py-2 text-sm text-white outline-none focus:border-[var(--ac)]"
                      style={{ ['--ac' as any]: accent }}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">{lang === 'fr' ? 'Nom' : 'Last name'}</label>
                    <input
                      value={nom}
                      onChange={(e) => setNom(e.target.value)}
                      placeholder="Shamoev"
                      className="w-full rounded border border-[#3A4242] bg-[#191E1E] px-3 py-2 text-sm text-white outline-none focus:border-[var(--ac)]"
                      style={{ ['--ac' as any]: accent }}
                    />
                  </div>
                </div>
                <div className="mt-4 flex min-h-[110px] items-center justify-center rounded-lg border border-[#3A4242] bg-white">
                  <span style={{ fontFamily: CURSIVE, fontSize: 52, color: '#1a1a1a' }}>{initials || '—'}</span>
                </div>
                <p className="mt-2 text-center text-[11px] text-[#A1A9A9]">{lang === 'fr' ? 'Vos initiales sont générées automatiquement.' : 'Your initials are generated automatically.'}</p>
              </div>
            )}

            {mode === 'import' && (
              <div>
                <label className="flex min-h-[150px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#3A4242] bg-white p-4 transition-colors hover:border-[var(--ac)]" style={{ ['--ac' as any]: accent }}>
                  {imported ? (
                    <img src={imported} alt="signature" className="max-h-[130px] max-w-full object-contain" />
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-[#A1A9A9]" />
                      <span className="text-sm text-[#444]">{lang === 'fr' ? 'Importer une image (PNG, JPEG…)' : 'Import an image (PNG, JPEG…)'}</span>
                    </>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={onFile} />
                </label>
              </div>
            )}

            {mode === 'draw' && (
              <div>
                <div className="relative rounded-lg border border-[#3A4242] bg-white">
                  <canvas
                    ref={canvasRef}
                    width={460}
                    height={150}
                    className="h-[150px] w-full touch-none rounded-lg"
                    onPointerDown={startDraw}
                    onPointerMove={moveDraw}
                    onPointerUp={endDraw}
                    onPointerLeave={endDraw}
                  />
                  <button
                    onClick={clearCanvas}
                    className="absolute right-2 top-2 flex items-center gap-1 rounded bg-[#191E1E]/80 px-2 py-1 text-[10px] font-medium text-[#A1A9A9] hover:text-white"
                  >
                    <Eraser className="h-3 w-3" /> {lang === 'fr' ? 'Effacer' : 'Clear'}
                  </button>
                </div>
                <p className="mt-2 text-center text-[11px] text-[#A1A9A9]">{lang === 'fr' ? 'Dessinez votre signature dans le cadre.' : 'Draw your signature inside the frame.'}</p>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="rounded border border-[#3A4242] px-4 py-2 text-sm font-medium text-[#A1A9A9] transition-colors hover:border-[#A1A9A9] hover:text-white"
              >
                {lang === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  const v = mode === 'initials' ? cursiveTextToDataUrl(initials) : currentValue();
                  if (!v) return;
                  setPending(v);
                  setConfirmStep(true);
                }}
                disabled={!canValidate()}
                className="rounded px-4 py-2 text-sm font-bold text-[#191E1E] transition-opacity disabled:opacity-40"
                style={{ background: accent }}
              >
                {lang === 'fr' ? 'Valider la signature' : 'Confirm signature'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function SignaturePreview({ value, color = '#1a1a1a', fontSize = 44 }: { value: string; color?: string; fontSize?: number }) {
  if (!value) return null;
  if (value.startsWith('data:'))
    return <img src={value} alt="signature" className="max-h-full max-w-full object-contain" style={{ display: 'block' }} />;
  return (
    <span className="max-w-full truncate" style={{ fontFamily: CURSIVE, fontSize, color, lineHeight: 1 }}>
      {value}
    </span>
  );
}
