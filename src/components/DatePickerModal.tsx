import { useMemo, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { todayLocalISO } from '../lib/signFieldsMeta';

/**
 * Calendrier modal (DA Sign) pour les champs Date.
 * Pointe par défaut sur AUJOURD'HUI dans le fuseau LOCAL de l'utilisateur (todayLocalISO,
 * pas d'UTC). onConfirm renvoie une date ISO "YYYY-MM-DD".
 * Le titre est cliquable : mois -> grille des mois, année -> grille des années.
 */
const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const MOIS_COURT = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];
const JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const pad = (n: number) => `${n}`.padStart(2, '0');
const toISO = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export default function DatePickerModal({
  open,
  value,
  accent = '#CEFF8F',
  onClose,
  onConfirm,
}: {
  open: boolean;
  value?: string;
  accent?: string;
  onClose: () => void;
  onConfirm: (iso: string) => void;
}) {
  const todayIso = todayLocalISO();
  const [todayY, todayMRaw] = todayIso.split('-').map(Number);
  const todayM = todayMRaw - 1;

  // Mois affiché : celui de la valeur courante (si valide) sinon aujourd'hui (local)
  const initial = useMemo(() => {
    const base = /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? (value as string) : todayIso;
    const [y, m] = base.split('-').map(Number);
    return { y, m: m - 1 };
  }, [value, todayIso, open]);

  const [view, setView] = useState(initial);
  const [mode, setMode] = useState<'days' | 'months' | 'years'>('days');
  const [yearStart, setYearStart] = useState(initial.y - 5);
  // resynchronise quand on rouvre / change de champ
  const [lastKey, setLastKey] = useState('');
  const key = `${open}|${value}`;
  if (open && key !== lastKey) {
    setLastKey(key);
    setView(initial);
    setMode('days');
  }

  if (!open) return null;

  const { y, m } = view;
  const first = new Date(y, m, 1);
  const startDow = (first.getDay() + 6) % 7; // lundi = 0
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () => setView(m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 });
  const nextMonth = () => setView(m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 });
  const openYears = () => {
    setYearStart(y - 5);
    setMode('years');
  };
  const years = Array.from({ length: 12 }, (_, i) => yearStart + i);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="w-full max-w-xs rounded-xl border border-[#3A4242] bg-[#222828] p-5 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Choisir une date</h3>
          <button onClick={onClose} className="text-[#A1A9A9] transition-colors hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* En-tête de navigation selon le mode */}
        {mode === 'days' && (
          <div className="mb-3 flex items-center justify-between">
            <button onClick={prevMonth} className="rounded p-1.5 text-[#A1A9A9] transition-colors hover:bg-[#3A4242] hover:text-white">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1 text-sm font-medium text-white">
              <button onClick={() => setMode('months')} className="rounded px-2 py-0.5 transition-colors hover:bg-[#3A4242]">
                {MOIS[m]}
              </button>
              <button onClick={openYears} className="rounded px-2 py-0.5 transition-colors hover:bg-[#3A4242]">
                {y}
              </button>
            </div>
            <button onClick={nextMonth} className="rounded p-1.5 text-[#A1A9A9] transition-colors hover:bg-[#3A4242] hover:text-white">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
        {mode === 'months' && (
          <div className="mb-3 flex items-center justify-between">
            <button onClick={() => setView({ y: y - 1, m })} className="rounded p-1.5 text-[#A1A9A9] transition-colors hover:bg-[#3A4242] hover:text-white">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={openYears} className="rounded px-2 py-0.5 text-sm font-medium text-white transition-colors hover:bg-[#3A4242]">
              {y}
            </button>
            <button onClick={() => setView({ y: y + 1, m })} className="rounded p-1.5 text-[#A1A9A9] transition-colors hover:bg-[#3A4242] hover:text-white">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
        {mode === 'years' && (
          <div className="mb-3 flex items-center justify-between">
            <button onClick={() => setYearStart(yearStart - 12)} className="rounded p-1.5 text-[#A1A9A9] transition-colors hover:bg-[#3A4242] hover:text-white">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium text-white">
              {yearStart} – {yearStart + 11}
            </span>
            <button onClick={() => setYearStart(yearStart + 12)} className="rounded p-1.5 text-[#A1A9A9] transition-colors hover:bg-[#3A4242] hover:text-white">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Corps selon le mode */}
        {mode === 'days' && (
          <>
            <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-[#6b7373]">
              {JOURS.map((j, i) => (
                <div key={i}>{j}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) => {
                if (d === null) return <div key={i} />;
                const iso = toISO(y, m, d);
                const isToday = iso === todayIso;
                const isSel = iso === value;
                return (
                  <button
                    key={i}
                    onClick={() => onConfirm(iso)}
                    className={`flex h-8 items-center justify-center rounded text-sm transition-colors ${
                      isSel ? 'font-bold text-[#191E1E]' : 'text-[#F3F4F6] hover:bg-[#3A4242]'
                    } ${isToday && !isSel ? 'ring-1 ring-inset' : ''}`}
                    style={{
                      background: isSel ? accent : undefined,
                      ...(isToday && !isSel ? ({ '--tw-ring-color': accent } as React.CSSProperties) : {}),
                    }}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </>
        )}
        {mode === 'months' && (
          <div className="grid grid-cols-3 gap-1.5">
            {MOIS_COURT.map((label, mi) => {
              const isSel = mi === m;
              const isCur = y === todayY && mi === todayM;
              return (
                <button
                  key={mi}
                  onClick={() => {
                    setView({ y, m: mi });
                    setMode('days');
                  }}
                  className={`flex h-9 items-center justify-center rounded text-xs transition-colors ${
                    isSel ? 'font-bold text-[#191E1E]' : 'text-[#F3F4F6] hover:bg-[#3A4242]'
                  } ${isCur && !isSel ? 'ring-1 ring-inset' : ''}`}
                  style={{
                    background: isSel ? accent : undefined,
                    ...(isCur && !isSel ? ({ '--tw-ring-color': accent } as React.CSSProperties) : {}),
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
        {mode === 'years' && (
          <div className="grid grid-cols-3 gap-1.5">
            {years.map((yr) => {
              const isSel = yr === y;
              const isCur = yr === todayY;
              return (
                <button
                  key={yr}
                  onClick={() => {
                    setView({ y: yr, m });
                    setMode('days');
                  }}
                  className={`flex h-9 items-center justify-center rounded text-xs transition-colors ${
                    isSel ? 'font-bold text-[#191E1E]' : 'text-[#F3F4F6] hover:bg-[#3A4242]'
                  } ${isCur && !isSel ? 'ring-1 ring-inset' : ''}`}
                  style={{
                    background: isSel ? accent : undefined,
                    ...(isCur && !isSel ? ({ '--tw-ring-color': accent } as React.CSSProperties) : {}),
                  }}
                >
                  {yr}
                </button>
              );
            })}
          </div>
        )}

        <button
          onClick={() => onConfirm(todayIso)}
          className="mt-4 w-full rounded border border-[#3A4242] py-2 text-xs font-medium text-[#A1A9A9] transition-colors hover:border-[#A1A9A9] hover:text-white"
        >
          Aujourd'hui
        </button>
      </div>
    </div>
  );
}
