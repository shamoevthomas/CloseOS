// Signature dessinée → SVG (lot 3). Les tracés sont gardés en vectoriel : la page de signature les
// affiche comme une image, le serveur les redessine tels quels dans le PDF signé (api/_lib/sign-seal.js).
// Format volontairement minimal (viewBox "0 0 w h", des <path> M/L), relu strictement par le serveur.

export type Point = { x: number; y: number };

const r1 = (n: number) => Math.round(n * 10) / 10;

export function strokesToSvg(strokes: Point[][], lineWidth = 2.5): string | null {
  const pts = strokes.flat();
  if (!pts.length) return null;
  const pad = lineWidth * 2;
  const minX = Math.min(...pts.map((p) => p.x)) - pad;
  const minY = Math.min(...pts.map((p) => p.y)) - pad;
  const w = r1(Math.max(...pts.map((p) => p.x)) - minX + pad);
  const h = r1(Math.max(...pts.map((p) => p.y)) - minY + pad);
  const paths = strokes
    .filter((s) => s.length)
    .map((s) => {
      const seq = s.length === 1 ? [s[0], s[0]] : s; // un point isolé reste visible (bout arrondi)
      const d = seq.map((p, i) => `${i ? 'L' : 'M'}${r1(p.x - minX)} ${r1(p.y - minY)}`).join(' ');
      return `<path d="${d}" fill="none" stroke="#1a1a1a" stroke-width="${lineWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${paths}</svg>`;
}

export function strokesToSvgDataUrl(strokes: Point[][], lineWidth = 2.5): string {
  const svg = strokesToSvg(strokes, lineWidth);
  return svg ? `data:image/svg+xml;base64,${btoa(svg)}` : '';
}

export const isSvgDataUrl = (v: string) => v.startsWith('data:image/svg+xml');

/** Rasterise un SVG en PNG (chemin de secours du PDF navigateur, jsPDF ne lit pas le SVG). */
export async function svgDataUrlToPng(dataUrl: string, scale = 4): Promise<string> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}
