/**
 * CloseOS Sign — champs encore à remplir par le signataire, pour la page de signature.
 * Fonctions pures (testées dans tests/sign/missing-fields.test.ts) : la page s'en sert pour le
 * compteur « X champs restants », le message au clic sur « Terminer et signer » et la mise en évidence.
 */

import { isValidEmail } from './signFieldsMeta';

export type MissingItem =
  | { key: string; kind: 'free' | 'inline'; type: string; page: number | null }
  | { key: 'consent'; kind: 'consent'; type: 'consent'; page: null };

export interface FreeFieldInput { id: string; type: string; page: number; y?: number; required?: boolean }
export interface InlineFieldInput { fid: string; type: string }

/** Un champ libre est rempli s'il a une valeur non vide (et un email valide pour le type email). */
export function isFreeFieldFilled(type: string, value: string | undefined | null): boolean {
  const v = (value ?? '').trim();
  if (!v) return false;
  if (type === 'email' && !isValidEmail(v)) return false;
  return true;
}

/**
 * Liste des éléments manquants, dans l'ordre du document (page, puis position verticale), la case
 * de consentement en dernier. Un champ libre marqué `required: false` n'est jamais exigé ; les champs
 * du texte (inline) n'ont pas cet attribut et restent obligatoires.
 */
export function listMissing(input: {
  freeFields: FreeFieldInput[];
  inlineFields: InlineFieldInput[];
  values: Record<string, string>;
  inlineValues: Record<string, string>;
  consented: boolean;
  /** Position d'un champ du texte (calculée depuis le rendu), ou null si inconnue. */
  inlinePosition?: (fid: string) => { page: number; y: number } | null;
}): MissingItem[] {
  const items: (MissingItem & { y: number; order: number })[] = [];
  input.freeFields.forEach((f, i) => {
    if (f.required === false) return;
    if (!isFreeFieldFilled(f.type, input.values[f.id])) {
      items.push({ key: f.id, kind: 'free', type: f.type, page: f.page || null, y: f.y ?? Infinity, order: i });
    }
  });
  input.inlineFields.forEach((f, i) => {
    if ((input.inlineValues[f.fid] ?? '').trim() === '') {
      const pos = input.inlinePosition?.(f.fid) ?? null;
      items.push({ key: f.fid, kind: 'inline', type: f.type, page: pos?.page ?? null, y: pos?.y ?? Infinity, order: 1000 + i });
    }
  });
  items.sort((a, b) => (a.page ?? Infinity) - (b.page ?? Infinity) || a.y - b.y || a.order - b.order);
  const out: MissingItem[] = items.map(({ y: _y, order: _order, ...rest }) => rest as MissingItem);
  if (!input.consented) out.push({ key: 'consent', kind: 'consent', type: 'consent', page: null });
  return out;
}

const LABELS: Record<string, [string, string]> = {
  signature: ['signature', 'signature'],
  initials: ['paraphe', 'initials'],
  name: ['nom', 'name'],
  firstname: ['prénom', 'first name'],
  lastname: ['nom de famille', 'last name'],
  date: ['date', 'date'],
  time: ['heure', 'time'],
  email: ['email', 'email'],
  tel: ['téléphone', 'phone'],
  address: ['adresse', 'address'],
  city: ['ville', 'city'],
  siret: ['SIRET', 'SIRET'],
  siren: ['SIREN', 'SIREN'],
  tva: ['n° de TVA', 'VAT number'],
  company_id: ['identifiant société', 'company ID'],
  ape: ['code APE', 'APE code'],
  checkbox: ['case à cocher', 'checkbox'],
  text: ['texte', 'text'],
};

export function fieldLabel(type: string, lang: 'fr' | 'en'): string {
  const l = LABELS[type];
  return l ? l[lang === 'fr' ? 0 : 1] : lang === 'fr' ? 'champ' : 'field';
}

/** « 3 champs restants » / « 1 champ restant » ; chaîne vide quand tout est rempli. */
export function remainingLabel(count: number, lang: 'fr' | 'en'): string {
  if (count <= 0) return '';
  if (lang === 'fr') return `${count} champ${count > 1 ? 's' : ''} restant${count > 1 ? 's' : ''}`;
  return `${count} field${count > 1 ? 's' : ''} left`;
}

/**
 * Message affiché au clic quand il manque des éléments, groupé par page :
 * « Il reste 3 champs à remplir : page 2 (signature, date), page 4 (case à cocher). »
 */
export function missingMessage(items: MissingItem[], lang: 'fr' | 'en'): string {
  if (items.length === 0) return '';
  const fr = lang === 'fr';
  const consent = items.some((i) => i.kind === 'consent');
  const fields = items.filter((i) => i.kind !== 'consent');

  const groups = new Map<string, string[]>();
  for (const f of fields) {
    const where = f.page ? (fr ? `page ${f.page}` : `page ${f.page}`) : fr ? 'dans le texte' : 'in the text';
    const list = groups.get(where) ?? [];
    list.push(fieldLabel(f.type, lang));
    groups.set(where, list);
  }
  const parts = [...groups.entries()].map(([where, labels]) => `${where} (${labels.join(', ')})`);
  if (consent) parts.push(fr ? 'la case « J’ai lu et j’accepte ce document »' : 'the “I have read and accept this document” box');

  const n = items.length;
  const head = fr
    ? `Il reste ${n} élément${n > 1 ? 's' : ''} à remplir`
    : `${n} item${n > 1 ? 's' : ''} left to complete`;
  if (fields.length === 0) {
    return fr ? 'Cochez la case « J’ai lu et j’accepte ce document » pour signer.' : 'Check the “I have read and accept this document” box to sign.';
  }
  const noun = fr ? (consent ? head : `Il reste ${n} champ${n > 1 ? 's' : ''} à remplir`) : head;
  return `${noun}${fr ? ' : ' : ': '}${parts.join(', ')}.`;
}
