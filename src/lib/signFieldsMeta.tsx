import { Signature, PenTool, User, Calendar, Clock, Mail, Phone, MapPin, Building2, Type, Hash, FileDigit, Percent, Landmark, Tag } from 'lucide-react';

// Texte par défaut d'une case à cocher de consentement (modifiable par champ via label)
export const CHECKBOX_DEFAULT_TEXT = 'Je reconnais avoir lu et accepté le document.';
export const isChecked = (v: string) => v === '1' || v === 'true' || v === 'on';

/** Métadonnées partagées des champs Sign (éditeur + page signataire). */

export type SignFieldType =
  | 'signature'
  | 'name'
  | 'date'
  | 'time'
  | 'email'
  | 'tel'
  | 'address'
  | 'city'
  | 'siret'
  | 'siren'
  | 'tva'
  | 'company_id'
  | 'ape'
  | 'checkbox'
  | 'text'
  | 'initials';

// Champs "identifiant d'entreprise" : texte libre, AUCUN format imposé (international), reliés au contact.
export const BUSINESS_FIELD_TYPES = ['siret', 'siren', 'tva', 'company_id', 'ape'] as const;
export const isBusinessIdField = (t: string) => (BUSINESS_FIELD_TYPES as readonly string[]).includes(t);

export const FIELD_META: Record<string, { label: string; Icon: typeof User }> = {
  signature: { label: 'Signature', Icon: Signature },
  initials: { label: 'Signature', Icon: PenTool }, // legacy → traité comme signature
  name: { label: 'Nom complet', Icon: User },
  date: { label: 'Date', Icon: Calendar },
  time: { label: 'Heure', Icon: Clock },
  email: { label: 'Email', Icon: Mail },
  tel: { label: 'Téléphone', Icon: Phone },
  address: { label: 'Adresse complète', Icon: MapPin },
  city: { label: 'Lieu de signature', Icon: Building2 },
  siret: { label: 'SIRET', Icon: FileDigit },
  siren: { label: 'SIREN', Icon: Hash },
  tva: { label: 'N° de TVA', Icon: Percent },
  company_id: { label: "N° d'entreprise", Icon: Landmark },
  ape: { label: 'Code APE/NAF', Icon: Tag },
  text: { label: 'Texte libre', Icon: Type },
};

// Palette proposée dans l'éditeur (Initiales fusionnées dans Signature)
export const PALETTE = [
  { type: 'signature', label: 'Signature', icon: Signature },
  { type: 'name', label: 'Nom complet', icon: User },
  { type: 'date', label: 'Date', icon: Calendar },
  { type: 'time', label: 'Heure', icon: Clock },
  { type: 'email', label: 'Email', icon: Mail },
  { type: 'tel', label: 'Téléphone', icon: Phone },
  { type: 'address', label: 'Adresse complète', icon: MapPin },
  { type: 'city', label: 'Lieu de signature', icon: Building2 },
  { type: 'siret', label: 'SIRET', icon: FileDigit },
  { type: 'siren', label: 'SIREN', icon: Hash },
  { type: 'tva', label: 'N° de TVA', icon: Percent },
  { type: 'company_id', label: "N° d'entreprise", icon: Landmark },
  { type: 'ape', label: 'Code APE/NAF', icon: Tag },
  { type: 'text', label: 'Texte libre', icon: Type },
] as const;

export const ROLE_COLOR: Record<'owner' | 'signer', string> = { signer: '#CEFF8F', owner: '#A0E7EC' };

export const isSignatureType = (t: string) => t === 'signature' || t === 'initials';

export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export function computeInitials(prenom: string, nom: string): string {
  const parts = [prenom, nom].map((s) => s.trim()).filter(Boolean);
  return parts.map((p) => p[0].toUpperCase()).join('.');
}

// Police manuscrite utilisée pour les signatures texte (initiales)
export const CURSIVE_FONT = '"Segoe Script","Bradley Hand","Snell Roundhand",cursive';

/** Rasterise un texte de signature (initiales) en PNG cursif — rendu identique site/PDF. */
export function cursiveTextToDataUrl(text: string): string {
  if (typeof document === 'undefined' || !text) return '';
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 220;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#1a1a1a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 130px ${CURSIVE_FONT}`;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 8);
  return canvas.toDataURL('image/png');
}

/** Date/heure locales par défaut (fuseau de l'utilisateur). */
export function todayLocalISO(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
export function nowLocalHM(): string {
  const d = new Date();
  return `${`${d.getHours()}`.padStart(2, '0')}:${`${d.getMinutes()}`.padStart(2, '0')}`;
}
export function formatDateFR(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}
