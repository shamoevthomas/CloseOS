import { describe, expect, it } from 'vitest';
import { freeFieldPage, listMissing, missingMessage, remainingLabel } from '../../src/lib/signMissingFields';

const base = { values: {}, inlineValues: {}, consented: true, inlineFields: [] };

describe('listMissing', () => {
  it('liste les champs obligatoires vides, par page, le consentement en dernier', () => {
    const items = listMissing({
      ...base,
      consented: false,
      freeFields: [
        { id: 'c', type: 'checkbox', page: 4 },
        { id: 's', type: 'signature', page: 2 },
        { id: 'd', type: 'date', page: 2 },
      ],
    });
    expect(items.map((i) => i.key)).toEqual(['s', 'd', 'c', 'consent']);
  });

  it('ignore les champs remplis et les champs non obligatoires', () => {
    const items = listMissing({
      ...base,
      freeFields: [
        { id: 'a', type: 'text', page: 1 },
        { id: 'b', type: 'text', page: 1, required: false },
      ],
      values: { a: 'ok' },
    });
    expect(items).toEqual([]);
  });

  it('suit la position verticale dans la page, champs libres et champs du texte mêlés', () => {
    const items = listMissing({
      ...base,
      freeFields: [{ id: 'sig', type: 'signature', page: 1, y: 700 }],
      inlineFields: [{ fid: 'f0', type: 'city' }],
      inlinePosition: () => ({ page: 1, y: 120 }),
    });
    expect(items.map((i) => i.key)).toEqual(['f0', 'sig']);
  });

  it("considère un email invalide comme manquant", () => {
    const items = listMissing({ ...base, freeFields: [{ id: 'e', type: 'email', page: 1 }], values: { e: 'pas-un-email' } });
    expect(items).toHaveLength(1);
  });

  it('traite les champs du texte comme obligatoires, avec leur page si connue', () => {
    const items = listMissing({
      ...base,
      freeFields: [],
      inlineFields: [{ fid: 'f0', type: 'city' }, { fid: 'f1', type: 'name' }],
      inlineValues: { f1: 'Dupont' },
      inlinePosition: () => ({ page: 3, y: 3500 }),
    });
    expect(items).toEqual([{ key: 'f0', kind: 'inline', type: 'city', page: 3 }]);
  });

  it('ne demande rien quand tout est rempli et coché', () => {
    expect(listMissing({ ...base, freeFields: [{ id: 's', type: 'signature', page: 1 }], values: { s: 'data:image/png;base64,x' } })).toEqual([]);
  });
});

describe('missingMessage', () => {
  it('reprend la formulation demandée', () => {
    const items = listMissing({
      ...base,
      freeFields: [
        { id: 's', type: 'signature', page: 2 },
        { id: 'd', type: 'date', page: 2 },
        { id: 'c', type: 'checkbox', page: 4 },
      ],
    });
    expect(missingMessage(items, 'fr')).toBe('Il reste 3 champs à remplir : page 2 (signature, date), page 4 (case à cocher).');
  });

  it('accorde au singulier', () => {
    const items = listMissing({ ...base, freeFields: [{ id: 's', type: 'signature', page: 1 }] });
    expect(missingMessage(items, 'fr')).toBe('Il reste 1 champ à remplir : page 1 (signature).');
  });

  it('mentionne la case de consentement avec les champs', () => {
    const items = listMissing({ ...base, consented: false, freeFields: [{ id: 's', type: 'signature', page: 1 }] });
    expect(missingMessage(items, 'fr')).toBe('Il reste 2 éléments à remplir : page 1 (signature), la case « J’ai lu et j’accepte ce document ».');
  });

  it('a un message dédié quand seule la case manque', () => {
    const items = listMissing({ ...base, consented: false, freeFields: [] });
    expect(missingMessage(items, 'fr')).toBe('Cochez la case « J’ai lu et j’accepte ce document » pour signer.');
  });

  it('existe en anglais', () => {
    const items = listMissing({ ...base, freeFields: [{ id: 's', type: 'signature', page: 2 }] });
    expect(missingMessage(items, 'en')).toBe('1 item left to complete: page 2 (signature).');
  });
});

describe('remainingLabel', () => {
  it('compte au singulier et au pluriel', () => {
    expect(remainingLabel(3, 'fr')).toBe('3 champs restants');
    expect(remainingLabel(1, 'fr')).toBe('1 champ restant');
    expect(remainingLabel(0, 'fr')).toBe('');
  });
});

describe('freeFieldPage', () => {
  it("déduit la page d'un champ de contrat texte de son ordonnée", () => {
    expect(freeFieldPage({ page: 1, y: 700 }, 'text', 1123)).toBe(1);
    expect(freeFieldPage({ page: 1, y: 1123 + 500 }, 'text', 1123)).toBe(2);
    expect(freeFieldPage({ page: 1, y: 3 * 1123 + 10 }, 'text', 1123)).toBe(4);
  });
  it('garde la page stockée pour un PDF', () => {
    expect(freeFieldPage({ page: 3, y: 200 }, 'pdf', 1123)).toBe(3);
  });
});
