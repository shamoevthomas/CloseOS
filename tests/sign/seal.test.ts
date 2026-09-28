// Lot 3 : PDF signé produit par le serveur (api/_lib/sign-seal.js) et signatures SVG.
import { degrees, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream, PDFArray, PDFRef, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { parseSignatureSvg, sealPdf } from '../../api/_lib/sign-seal.js';
import { strokesToSvg, strokesToSvgDataUrl } from '../../src/lib/signSignatureSvg';

// PNG 1×1 noir
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const SVG = strokesToSvgDataUrl([[{ x: 10, y: 60 }, { x: 80, y: 20 }, { x: 150, y: 70 }], [{ x: 40, y: 40 }]]);

async function sourcePdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  doc.addPage([595.28, 841.89]).drawText('Devis page 1', { x: 50, y: 780, size: 14, font });
  doc.addPage([841.89, 595.28]).drawText('Annexe paysage', { x: 50, y: 300, size: 14, font });
  const p3 = doc.addPage([595.28, 841.89]); // page tournée : affichée en paysage
  p3.drawText('Page tournee', { x: 50, y: 780, size: 14, font });
  p3.setRotation(degrees(90));
  return doc.save();
}

/** Contenu décompressé d'une page + noms des XObjects (images, formulaires) qu'elle utilise. */
function pageContent(doc: PDFDocument, i: number) {
  const page = doc.getPage(i);
  const contents = page.node.Contents();
  const refs = contents instanceof PDFArray ? contents.asArray() : [contents];
  const text = refs.map((r) => {
    const s = doc.context.lookup(r as PDFRef) as PDFRawStream;
    return Buffer.from(decodePDFRawStream(s).decode()).toString('latin1');
  }).join('\n');
  const xo = page.node.Resources()?.lookup(PDFName.of('XObject'));
  return { text, xobjects: xo ? (xo as any).keys().length : 0 };
}

const field = (over: Record<string, unknown>) => ({ id: 'f', field_type: 'text', page: 1, pos_x: 100, pos_y: 100, width: 200, height: 40, value: 'x', label: null, ...over });

describe('sealPdf — PDF d\'origine + champs', () => {
  it('garde le nombre, le format et l\'orientation des pages', async () => {
    const sealed = await PDFDocument.load(await sealPdf(await sourcePdf(), [field({ page: 2, field_type: 'date', value: '2026-09-28' }), field({ page: 3, value: 'Lu et approuvé' })]));
    const sizes = sealed.getPages().map((p) => { const { width, height } = p.getSize(); return [Math.round(width), Math.round(height), p.getRotation().angle]; });
    expect(sizes).toEqual([[595, 842, 0], [842, 595, 0], [842, 595, 0]]); // la page tournée est redressée, affichée pareil
  });

  it('dessine la signature SVG en vectoriel (tracés, aucune image) et le texte en texte', async () => {
    const bytes = await sealPdf(await sourcePdf(), [
      field({ field_type: 'signature', value: SVG, pos_x: 500, pos_y: 950, width: 200, height: 64 }),
      field({ page: 2, field_type: 'date', value: '2026-09-28' }),
    ]);
    const doc = await PDFDocument.load(bytes);
    const p1 = pageContent(doc, 0);
    expect(p1.xobjects).toBe(0);
    expect(p1.text).toMatch(/\d+(\.\d+)? \d+(\.\d+)? m[\s\S]*\d+(\.\d+)? \d+(\.\d+)? l[\s\S]*S/); // moveto / lineto / stroke
    expect(p1.text).toContain('1 J'); // bouts ronds
    const p2 = pageContent(doc, 1);
    expect(p2.text).toContain('<32382F30392F32303236> Tj'); // « 28/09/2026 » en Helvetica
  });

  it('place les champs dans le repère de la page affichée (794 px de large)', async () => {
    const doc = await PDFDocument.load(await sealPdf(await sourcePdf(), [field({ field_type: 'checkbox', value: '1', pos_x: 0, pos_y: 0, width: 360, height: 44 })]));
    const { text } = pageContent(doc, 0);
    // Case en haut à gauche : x ≈ 0, y proche du haut de la page A4 (842 pt)
    const box = text.match(/1 0 0 1 (-?[\d.]+) (-?[\d.]+) cm/); // pdf-lib pose le rectangle par translation
    expect(box).toBeTruthy();
    expect(Number(box![1])).toBeCloseTo(0, 0);
    // Champ de 44 px (33 pt) en haut de la page, case de 5 mm centrée : 842 − 33 + (33 − 14,2) / 2 ≈ 818
    expect(Number(box![2])).toBeCloseTo(818.3, 0);
  });

  it('accepte une image importée et des initiales tapées', async () => {
    const doc = await PDFDocument.load(await sealPdf(await sourcePdf(), [
      field({ field_type: 'signature', value: PNG }),
      field({ field_type: 'initials', value: 'J.D', pos_y: 300 }),
    ]));
    const p1 = pageContent(doc, 0);
    expect(p1.xobjects).toBe(1);
    expect(p1.text).toContain('Tj');
  });

  it('remplace les caractères hors police au lieu d\'échouer', async () => {
    await expect(sealPdf(await sourcePdf(), [field({ value: 'Réf. 42 — 𝒳 ✓ 😀' })])).resolves.toBeInstanceOf(Uint8Array);
  });

  it('refuse un champ sur une page inexistante', async () => {
    await expect(sealPdf(await sourcePdf(), [field({ page: 9 })])).rejects.toThrow(/page inexistante/);
  });
});

describe('signatures SVG', () => {
  it('la modale produit un SVG minimal, recadré, relu par le serveur', () => {
    const svg = strokesToSvg([[{ x: 100, y: 100 }, { x: 200, y: 150 }]])!;
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 110 60"/);
    expect(svg).toContain('d="M5 5 L105 55"');
    const parsed = parseSignatureSvg(strokesToSvgDataUrl([[{ x: 100, y: 100 }, { x: 200, y: 150 }], [{ x: 150, y: 120 }]]))!;
    expect(parsed).toMatchObject({ minX: 0, minY: 0, width: 110, height: 60 });
    expect(parsed.paths).toHaveLength(2); // le point isolé est gardé
  });

  it('refuse tout SVG qui ne soit pas un simple tracé', () => {
    const b64 = (s: string) => `data:image/svg+xml;base64,${Buffer.from(s).toString('base64')}`;
    expect(() => parseSignatureSvg(b64('<svg viewBox="0 0 10 10"><script>alert(1)</script><path d="M0 0 L1 1"/></svg>'))).toThrow();
    expect(() => parseSignatureSvg(b64('<svg viewBox="0 0 10 10"><image href="http://x"/></svg>'))).toThrow();
    expect(() => parseSignatureSvg(b64('<svg viewBox="0 0 10 10"><path d="M0 0 A1 1 0 0 1 5 5"/></svg>'))).toThrow();
    expect(() => parseSignatureSvg(b64('<svg><path d="M0 0 L1 1"/></svg>'))).toThrow(/viewBox/);
    expect(parseSignatureSvg(PNG)).toBeNull();
  });
});
