import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import SignatureModal, { SignaturePreview } from './SignatureModal';
import DatePickerModal from './DatePickerModal';
import PhoneInput from './PhoneInput';
import PlacesInput from './PlacesInput';
import {
  FIELD_META,
  ROLE_COLOR,
  isSignatureType,
  isValidEmail,
  isChecked,
  CHECKBOX_DEFAULT_TEXT,
  cursiveTextToDataUrl,
  todayLocalISO,
  nowLocalHM,
  formatDateFR,
} from '../lib/signFieldsMeta';
import type { SignFreeField } from '../lib/signContracts';

/**
 * Champ remplissable côté signataire / propriétaire (rendu au-dessus du document).
 * Gère : signature (modale), nom/texte, email (validé), date (auj. local), heure (now local).
 */
export default function FillableField({
  field,
  value,
  onChange,
  readOnly = false,
  onBeforeSign,
}: {
  field: SignFreeField;
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
  /** Verrou avant ouverture du pad signature (ex. vérification email). Doit résoudre true pour autoriser. */
  onBeforeSign?: () => Promise<boolean>;
}) {
  const accent = ROLE_COLOR[field.role] ?? ROLE_COLOR.signer;
  const meta = FIELD_META[field.type] ?? FIELD_META.text;
  const labelText = field.label?.trim() ? field.label : meta.label;
  const fontSize = Math.max(10, Math.min(field.h * 0.42, 30));
  const [sigOpen, setSigOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const filled = !!value;

  // Auto-remplissage date/heure (fuseau local) au premier affichage
  const did = useRef(false);
  useEffect(() => {
    if (did.current || readOnly || value) return;
    did.current = true;
    if (field.type === 'date') onChange(todayLocalISO());
    if (field.type === 'time') onChange(nowLocalHM());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const base: React.CSSProperties = {
    left: field.x,
    top: field.y,
    width: field.w,
    height: field.h,
  };

  const boxCls = 'absolute z-20 flex items-center justify-center overflow-hidden rounded-md';

  // ---- Case à cocher (consentement) ----
  if (field.type === 'checkbox') {
    const checked = isChecked(value);
    const text = field.label?.trim() ? field.label : CHECKBOX_DEFAULT_TEXT;
    const cbFont = Math.max(10, Math.min(field.h * 0.32, 15));
    const boxSize = Math.max(14, Math.min(field.h * 0.5, 22));
    return (
      <div
        data-sign-field
        onClick={readOnly ? undefined : () => onChange(checked ? '' : '1')}
        className={`absolute z-20 flex items-center gap-2 rounded-md px-2 ${readOnly ? '' : 'cursor-pointer'}`}
        style={{ ...base, border: `${checked ? 1 : 2}px ${checked ? 'solid' : 'dashed'} ${accent}`, background: checked ? '#fff' : `${accent}1f` }}
        title={readOnly ? undefined : 'Cliquer pour cocher'}
      >
        <span
          className="flex shrink-0 items-center justify-center rounded font-bold leading-none"
          style={{ width: boxSize, height: boxSize, border: `2px solid ${checked ? accent : '#9aa3a3'}`, background: checked ? accent : 'transparent', color: '#191E1E', fontSize: boxSize * 0.78 }}
        >
          {checked ? '✓' : ''}
        </span>
        <span className="leading-tight" style={{ fontSize: cbFont, color: '#1a1a1a' }}>{text}</span>
      </div>
    );
  }

  // ---- Lecture seule ----
  if (readOnly) {
    return (
      <div data-sign-field className={boxCls} style={{ ...base, border: `1px dashed ${accent}`, color: filled ? '#1a1a1a' : accent, background: filled ? '#fff' : '#191E1E' }}>
        {renderValue(field.type, value, fontSize, accent, labelText)}
      </div>
    );
  }

  const invalid = field.type === 'email' && value.trim() !== '' && !isValidEmail(value);

  // ---- Signature ----
  if (isSignatureType(field.type)) {
    return (
      <>
        <div
          data-sign-field
          onClick={async () => {
            if (onBeforeSign && !(await onBeforeSign())) return; // ex. vérification email requise
            setSigOpen(true);
          }}
          className={`${boxCls} cursor-pointer transition-colors`}
          style={{
            ...base,
            border: `${filled ? 1 : 2}px ${filled ? 'solid' : 'dashed'} ${accent}`,
            background: filled ? '#fff' : `${accent}1f`,
          }}
          title="Cliquer pour signer"
        >
          {filled ? (
            value.startsWith('data:') ? (
              <div
                className="h-full w-full"
                style={{ backgroundImage: `url("${value}")`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center overflow-hidden p-1">
                <SignaturePreview value={value} fontSize={Math.min(field.h * 0.6, 40)} />
              </div>
            )
          ) : (
            <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider" style={{ color: accent, fontSize: Math.min(fontSize, 13) }}>
              <meta.Icon style={{ width: 14, height: 14 }} /> {labelText}
            </span>
          )}
        </div>
        <SignatureModal open={sigOpen} onClose={() => setSigOpen(false)} accent={accent} onConfirm={(v) => { onChange(v); setSigOpen(false); }} />
      </>
    );
  }

  // ---- Champs saisie (texte / nom / email / date / heure) ----
  const commonInput: React.CSSProperties = {
    fontSize,
    color: '#1a1a1a',
    background: 'transparent',
    width: '100%',
    height: '100%',
    textAlign: 'center',
    outline: 'none',
    border: 'none',
    padding: '0 6px',
  };

  // ---- Date : ouvre un calendrier modal (jour actuel local par défaut) ----
  if (field.type === 'date') {
    return (
      <>
        <div
          data-sign-field
          onClick={() => setDateOpen(true)}
          className={`${boxCls} cursor-pointer`}
          style={{ ...base, border: `${filled ? 1 : 2}px ${filled ? 'solid' : 'dashed'} ${accent}`, background: filled ? '#fff' : `${accent}1f` }}
          title="Choisir une date"
        >
          <span className="truncate px-1" style={{ fontSize, color: filled ? '#1a1a1a' : accent, fontWeight: filled ? 400 : 700 }}>
            {value ? formatDateFR(value) : labelText}
          </span>
        </div>
        <DatePickerModal
          open={dateOpen}
          value={value || todayLocalISO()}
          accent={accent}
          onClose={() => setDateOpen(false)}
          onConfirm={(iso) => {
            onChange(iso);
            setDateOpen(false);
          }}
        />
      </>
    );
  }

  let inputEl: React.ReactNode;
  if (field.type === 'time') {
    inputEl = <input type="time" value={value || nowLocalHM()} onChange={(e) => onChange(e.target.value)} style={commonInput} />;
  } else if (field.type === 'email') {
    inputEl = <input type="email" value={value} placeholder="email@exemple.fr" onChange={(e) => onChange(e.target.value)} style={commonInput} />;
  } else if (field.type === 'tel') {
    inputEl = <PhoneInput variant="plain" value={value} onChange={onChange} fontSize={Math.min(fontSize, 14)} />;
  } else if (field.type === 'address' || field.type === 'city') {
    inputEl = <PlacesInput mode={field.type} value={value} onChange={onChange} fontSize={fontSize} placeholder={labelText} />;
  } else {
    inputEl = (
      <input
        type="text"
        value={value}
        placeholder={labelText}
        onChange={(e) => onChange(e.target.value)}
        style={commonInput}
      />
    );
  }

  // Le champ téléphone ouvre un menu déroulant → pas d'overflow-hidden, z-index supérieur
  const wrapCls =
    field.type === 'tel'
      ? 'absolute z-30 flex items-center rounded-md px-1'
      : boxCls;

  return (
    <div
      data-sign-field
      className={wrapCls}
      style={{
        ...base,
        border: `${filled ? 1 : 2}px ${filled ? 'solid' : 'dashed'} ${invalid ? '#ef4444' : accent}`,
        background: filled ? '#fff' : `${accent}1f`,
      }}
    >
      {inputEl}
    </div>
  );
}

function renderValue(type: string, value: string, fontSize: number, accent: string, label: string) {
  if (!value) {
    const meta = FIELD_META[type] ?? FIELD_META.text;
    return (
      <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider" style={{ color: accent, fontSize: Math.min(fontSize, 13) }}>
        <meta.Icon style={{ width: 14, height: 14 }} /> {label}
      </span>
    );
  }
  if (isSignatureType(type)) {
    // <img> (et non background-image / object-fit) → rendu fidèle dans le PDF (html2canvas)
    const src = value.startsWith('data:') ? value : cursiveTextToDataUrl(value);
    return (
      <div className="flex h-full w-full items-center justify-center overflow-hidden p-1">
        <img src={src} alt="signature" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      </div>
    );
  }
  const display = type === 'date' ? formatDateFR(value) : value;
  return <AutoFitValue text={display} maxFont={fontSize} color="#1a1a1a" />;
}

/**
 * Affiche une valeur texte ENTIÈREMENT visible dans une boîte de taille fixe :
 * réduit la police (jusqu'à un minimum) puis passe à la ligne pour que rien ne soit rogné.
 * (« quelques caractères » -> police plus petite ; texte long -> retour à la ligne.)
 */
function AutoFitValue({ text, maxFont, color }: { text: string; maxFont: number; color: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const spanRef = useRef<HTMLSpanElement>(null);
  const [fs, setFs] = useState(maxFont);
  useLayoutEffect(() => {
    const box = boxRef.current;
    const span = spanRef.current;
    if (!box || !span) return;
    let size = maxFont;
    span.style.fontSize = `${size}px`;
    const fits = () => span.scrollWidth <= box.clientWidth + 0.5 && span.scrollHeight <= box.clientHeight + 0.5;
    let guard = 0;
    while (size > 6 && !fits() && guard < 80) {
      size -= 0.5;
      span.style.fontSize = `${size}px`;
      guard++;
    }
    setFs(size);
  }, [text, maxFont]);
  return (
    <div ref={boxRef} className="flex h-full w-full items-center justify-center overflow-hidden px-1">
      <span
        ref={spanRef}
        style={{ fontSize: fs, color, lineHeight: 1.15, whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word', textAlign: 'center', maxWidth: '100%' }}
      >
        {text}
      </span>
    </div>
  );
}
