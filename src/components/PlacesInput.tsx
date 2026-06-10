/**
 * Champ texte adresse / ville (saisie libre, sans dépendance externe).
 * (Anciennement autocomplétion Google Places — retirée car non fonctionnelle.)
 *  - mode 'address' / 'city' : conservés pour compatibilité d'appel (sans effet ici)
 */
export default function PlacesInput({
  value,
  onChange,
  fontSize,
  placeholder,
  variant = 'plain',
}: {
  value: string;
  onChange: (v: string) => void;
  mode?: 'address' | 'city';
  fontSize?: number;
  placeholder?: string;
  variant?: 'plain' | 'dark';
}) {
  const common = {
    type: 'text' as const,
    value,
    placeholder,
    autoComplete: 'off',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
  };

  if (variant === 'dark') {
    return (
      <input
        {...common}
        className="w-full rounded border border-[#3A4242] bg-[#191E1E] py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-[#A1A9A9]/40 focus:border-[#CEFF8F]"
      />
    );
  }

  return (
    <input
      {...common}
      style={{
        fontSize,
        color: '#1a1a1a',
        background: 'transparent',
        width: '100%',
        height: '100%',
        textAlign: 'center',
        outline: 'none',
        border: 'none',
        padding: '0 6px',
      }}
    />
  );
}
