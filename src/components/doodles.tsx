/* ────────────────────────────────────────────────────────────────
   DOODLES — petits dessins line-art faits main (style Tally).
   Décoratifs : la couleur suit `currentColor` (pilotée par la classe
   text-* au point d'appel). À poser en absolute avec pointer-events-none,
   aria-hidden, masqués sur mobile. Partagés entre les LP Sales & Business.
   ──────────────────────────────────────────────────────────────── */
export type DoodleProps = { className?: string }

/* Souligné ondulé (sous un mot clé) */
export function DoodleSquiggle({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 240 18" fill="none" className={className} aria-hidden="true">
      <path d="M4 11C24 2 44 2 64 8s40 8 60 1 42-8 60-2 44 6 52 2" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* Cercle griffonné autour d'un mot (boucle ouverte qui déborde) */
export function DoodleCircle({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 260 110" fill="none" className={className} aria-hidden="true">
      <path d="M78 16C40 22 12 40 15 63c4 27 66 34 128 27 47-5 104-20 106-44C251 25 190 10 128 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/* Bulle de dialogue avec petits traits */
export function DoodleBubble({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 96 78" fill="none" className={className} aria-hidden="true">
      <path d="M10 14c0-6 5-10 13-10h50c8 0 13 4 13 10v30c0 6-5 10-13 10H44L26 68l3-14h-6c-8 0-13-4-13-10z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M26 26h44M26 36h30" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/* Petit visage esquissé */
export function DoodleFace({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 84 84" fill="none" className={className} aria-hidden="true">
      <path d="M42 6C22 6 8 22 8 42s14 36 34 36 34-16 34-36S62 6 42 6z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M28 36c2-3 8-3 10 0M46 36c2-3 8-3 10 0" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M30 52c6 8 18 8 24 0" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/* Avion en papier avec traînée pointillée */
export function DoodlePlane({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 130 96" fill="none" className={className} aria-hidden="true">
      <path d="M6 90C34 66 66 26 118 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="1 9" opacity="0.55" />
      <path d="M118 8L92 44 82 30 64 40z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M82 30l10 14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* Flèche courbe façon "clique ici" */
export function DoodleArrow({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 120 96" fill="none" className={className} aria-hidden="true">
      <path d="M12 12c46 4 82 30 86 68" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M74 66l24 16 6-26" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* Étincelle 4 branches */
export function DoodleSparkle({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <path d="M16 3c1 7 5 11 12 13-7 2-11 6-12 13-1-7-5-11-12-13 7-2 11-6 12-13z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  )
}

/* Petite croix / plus */
export function DoodleCross({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/* Tirets de mouvement en diagonale */
export function DoodleDashes({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 60 40" fill="none" className={className} aria-hidden="true">
      <path d="M4 30L18 12M22 34L36 16M40 30L52 14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/* Éclair */
export function DoodleBolt({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 28 38" fill="none" className={className} aria-hidden="true">
      <path d="M17 3 5 22h8l-2 13 12-20h-8l2-12z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* Cible / bullseye */
export function DoodleTarget({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <path d="M24 5C13 6 6 15 6 24s8 18 18 19 18-9 18-19S35 6 24 5z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 15c-5 0-9 4-9 9s4 9 9 9 9-4 9-9-4-9-9-9z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 21a3 3 0 100 6 3 3 0 000-6z" fill="currentColor" />
    </svg>
  )
}

/* Fusée */
export function DoodleRocket({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 40 48" fill="none" className={className} aria-hidden="true">
      <path d="M20 3c7 6 9 16 8 24l-5 5h-6l-5-5c-1-8 1-18 8-24z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 15a3 3 0 100 6 3 3 0 000-6z" stroke="currentColor" strokeWidth="2.5" />
      <path d="M13 28l-5 6 3 2M27 28l5 6-3 2M17 33c1 4 3 8 3 8s2-4 3-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* Pièce € */
export function DoodleCoin({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <path d="M20 4C11 4 4 11 4 20s7 16 16 16 16-7 16-16S29 4 20 4z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M26 14c-2-2-5-2-7 0-3 3-3 9 0 12 2 2 5 2 7 0M13 18h9M13 23h7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

/* Courbe qui monte (perf) */
export function DoodleChartUp({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 46 40" fill="none" className={className} aria-hidden="true">
      <path d="M8 5v29h32" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M13 28l7-9 6 4 10-13" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M31 10h6v6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* Cœur */
export function DoodleHeart({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 40 36" fill="none" className={className} aria-hidden="true">
      <path d="M20 33S5 23 5 13c0-5 4-8 8-8 3 0 5 2 7 4 2-2 4-4 7-4 4 0 8 3 8 8 0 10-15 20-15 20z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* Étoile 5 branches */
export function DoodleStar5({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <path d="M20 4l5 11 12 1-9 8 3 12-11-7-11 7 3-12-9-8 12-1z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* Éclat "pow" (rayons) */
export function DoodleBurst({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <path d="M20 4v7M20 29v7M4 20h7M29 20h7M9 9l5 5M26 26l5 5M31 9l-5 5M14 26l-5 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

/* Check / validé */
export function DoodleCheck({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 34 30" fill="none" className={className} aria-hidden="true">
      <path d="M4 16l8 9L30 5" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* Ampoule (idée) */
export function DoodleBulb({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 36 40" fill="none" className={className} aria-hidden="true">
      <path d="M18 6c-6 0-10 4-10 10 0 4 2 6 4 8v4h12v-4c2-2 4-4 4-8 0-6-4-10-10-10z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 32h10M15 36h6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M18 1v3M5 8l2 2M31 8l-2 2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

/* Trophée */
export function DoodleTrophy({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 36 42" fill="none" className={className} aria-hidden="true">
      <path d="M9 5h18v7c0 6-4 10-9 10s-9-4-9-10zM9 8H5c0 5 3 8 6 8M27 8h4c0 5-3 8-6 8M18 22v7M13 34h10l1 5H12z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* Horloge */
export function DoodleClock({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <path d="M20 5C12 5 5 12 5 20s7 15 15 15 15-7 15-15S28 5 20 5z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M20 11v9l6 4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* Flèche courbe (autre sens) */
export function DoodleArrowDown({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <path d="M33 7C17 7 8 17 8 33" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M2 25l6 9 9-3" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* Zigzag énergique */
export function DoodleZigzag({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 64 22" fill="none" className={className} aria-hidden="true">
      <path d="M3 11l9-7 8 12 8-12 8 12 8-12 8 12 5-6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
