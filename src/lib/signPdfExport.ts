import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { isSignatureType, formatDateFR, cursiveTextToDataUrl, isChecked, CHECKBOX_DEFAULT_TEXT } from './signFieldsMeta';
import type { SignFreeField, OverlayImage } from './signContracts';

/**
 * Génération du PDF du contrat signé — méthode robuste :
 *  - le FOND du document (texte ou PDF, SANS les champs) est rendu en image (html2canvas / pdf.js)
 *  - chaque champ est ensuite dessiné par jsPDF à ses coordonnées exactes
 *    (signature en image avec ratio respecté, texte centré). Plus aucun décalage.
 */

const A4_W = 210; // mm
const PX_TO_PT = 0.75; // 96dpi → pt

type PdfPage = { width: number; height: number; dataUrl: string };
type GenOpts = {
  sourceType: 'text' | 'pdf';
  textPageEl?: HTMLElement | null;
  pdfPages?: PdfPage[];
  fields: SignFreeField[];
  images?: OverlayImage[];
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(',')[1] ?? '');
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

const A4_H = 297; // mm

/**
 * Capture FIDÈLE de la page (`.pg-stack`) telle qu'affichée à l'écran : contenu + valeurs inline
 * + champs (signatures <img>, cases, texte). On retire uniquement le "chrome" écran : bandes
 * sombres entre feuilles (`.pg-divider`), numéros de page (`.pg-num`) et ombres des feuilles.
 * → le PDF est une copie pixel du rendu du site.
 */
async function fullCapture(el: HTMLElement): Promise<{ canvas: HTMLCanvasElement; wPx: number; hPx: number }> {
  const wPx = el.offsetWidth;
  const hPx = el.offsetHeight;
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.pg-divider, .pg-num').forEach((n) => n.remove());
  clone.querySelectorAll('.pg-sheet').forEach((n) => {
    (n as HTMLElement).style.boxShadow = 'none';
    (n as HTMLElement).style.borderRadius = '0';
  });
  // Champs (inline + libres) : pas d'arrondi ni de débordement masqué -> aucun texte rogné dans le PDF,
  // et le texte long reste entièrement visible (retour à la ligne).
  clone.querySelectorAll<HTMLElement>('.sign-field, .sf-inline-input, [data-field], [data-sign-field]').forEach((n) => {
    n.style.borderRadius = '0';
    n.style.overflow = 'visible';
    n.style.boxShadow = 'none';
    n.style.textOverflow = 'clip';
    n.style.whiteSpace = 'normal';
    n.style.overflowWrap = 'anywhere';
    n.style.wordBreak = 'break-word';
  });
  clone.style.position = 'fixed';
  clone.style.left = '-100000px';
  clone.style.top = '0';
  clone.style.margin = '0';
  document.body.appendChild(clone);
  try {
    const canvas = await html2canvas(clone, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      width: wPx,
      height: hPx,
      windowWidth: wPx,
    });
    return { canvas, wPx, hPx };
  } finally {
    document.body.removeChild(clone);
  }
}

async function drawImages(pdf: jsPDF, images: OverlayImage[], mmPerPx: number) {
  for (const im of images) {
    if (!im.src) continue;
    const fmt = im.src.includes('image/png') ? 'PNG' : 'JPEG';
    try {
      pdf.addImage(im.src, fmt, im.x * mmPerPx, im.y * mmPerPx, im.w * mmPerPx, im.h * mmPerPx, undefined, 'FAST');
    } catch (e) {
      console.error('[sign] pdf image', e);
    }
  }
}

async function drawFields(pdf: jsPDF, fields: SignFreeField[], mmPerPx: number) {
  for (const f of fields) {
    const v = f.value ?? '';
    if (!v) continue;
    const x = f.x * mmPerPx;
    const y = f.y * mmPerPx;
    const w = f.w * mmPerPx;
    const h = f.h * mmPerPx;

    if (f.type === 'checkbox') {
      const checked = isChecked(v);
      const text = f.label && f.label.trim() ? f.label : CHECKBOX_DEFAULT_TEXT;
      const boxMm = Math.min(h * 0.55, 5);
      const by = y + (h - boxMm) / 2;
      pdf.setDrawColor(60, 60, 60);
      pdf.setLineWidth(0.3);
      pdf.rect(x, by, boxMm, boxMm);
      if (checked) {
        pdf.setLineWidth(0.5);
        pdf.line(x + boxMm * 0.2, by + boxMm * 0.55, x + boxMm * 0.42, by + boxMm * 0.82);
        pdf.line(x + boxMm * 0.42, by + boxMm * 0.82, x + boxMm * 0.82, by + boxMm * 0.2);
      }
      const ptc = Math.max(8, Math.min(f.h * 0.32, 14)) * PX_TO_PT;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(ptc);
      pdf.setTextColor(26, 26, 26);
      pdf.text(String(text), x + boxMm + 1.5, y + h / 2, { baseline: 'middle', maxWidth: Math.max(1, w - boxMm - 2) });
      continue;
    }

    if (isSignatureType(f.type)) {
      // Signature : image directe, ou texte d'initiales rasterisé en cursif (rendu identique au site)
      const dataUrl = v.startsWith('data:') ? v : cursiveTextToDataUrl(v);
      if (!dataUrl) continue;
      let dw = w;
      let dh = h;
      try {
        const img = await loadImage(dataUrl);
        const ar = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : w / h;
        dw = w;
        dh = w / ar;
        if (dh > h) {
          dh = h;
          dw = h * ar;
        }
      } catch {
        /* fallback : remplit la boîte */
      }
      pdf.addImage(dataUrl, 'PNG', x + (w - dw) / 2, y + (h - dh) / 2, dw, dh, undefined, 'FAST');
    } else {
      const txt = f.type === 'date' ? formatDateFR(v) : v;
      const pt = Math.max(8, Math.min(f.h * 0.42, 30)) * PX_TO_PT;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(pt);
      pdf.setTextColor(26, 26, 26);
      pdf.text(String(txt), x + w / 2, y + h / 2, { align: 'center', baseline: 'middle', maxWidth: w });
    }
  }
}

export async function buildSignedPdfBlob(opts: GenOpts): Promise<Blob> {
  let pdf: jsPDF | null = null;

  if (opts.sourceType === 'pdf' && opts.pdfPages && opts.pdfPages.length > 0) {
    for (let i = 0; i < opts.pdfPages.length; i++) {
      const pg = opts.pdfPages[i];
      const mmPerPx = A4_W / pg.width;
      const hMm = pg.height * mmPerPx;
      if (!pdf) pdf = new jsPDF({ unit: 'mm', format: [A4_W, hMm], orientation: 'portrait' });
      else pdf.addPage([A4_W, hMm]);
      pdf.addImage(pg.dataUrl, 'PNG', 0, 0, A4_W, hMm, undefined, 'FAST');
      await drawImages(pdf, (opts.images ?? []).filter((im) => im.page === i + 1), mmPerPx);
      await drawFields(pdf, opts.fields.filter((f) => f.page === i + 1), mmPerPx);
    }
  } else if (opts.textPageEl) {
    // Contrat texte : on capture la page COMPLÈTE telle qu'affichée (contenu + champs) et on la
    // découpe par feuille A4. Aucun redraw jsPDF → le PDF est identique au rendu du site.
    const bg = await fullCapture(opts.textPageEl);
    const wPx = bg.wPx;
    const mmPerPx = A4_W / wPx;
    const scale = bg.canvas.width / wPx; // échelle html2canvas (≈2)
    const pageHpx = (wPx * A4_H) / A4_W; // hauteur d'une feuille A4 en px du document
    const pages = Math.max(1, Math.ceil((bg.hPx - 2) / pageHpx));

    for (let p = 0; p < pages; p++) {
      if (!pdf) pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      else pdf.addPage('a4');

      const yTop = p * pageHpx;
      const sliceHpx = Math.min(pageHpx, bg.hPx - yTop);
      if (sliceHpx <= 0) continue;
      const slice = document.createElement('canvas');
      slice.width = bg.canvas.width;
      slice.height = Math.max(1, Math.round(sliceHpx * scale));
      const ctx = slice.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(bg.canvas, 0, Math.round(yTop * scale), slice.width, slice.height, 0, 0, slice.width, slice.height);
      }
      pdf.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, A4_W, sliceHpx * mmPerPx, undefined, 'FAST');
    }
  }

  if (!pdf) throw new Error('Aucun contenu à exporter');
  return pdf.output('blob');
}

/** Document signé en data-URI base64 (pour l'envoyer au scellement serveur du certificat). */
export async function buildSignedPdfDataUri(opts: GenOpts): Promise<string> {
  const blob = await buildSignedPdfBlob(opts);
  const base64 = await blobToBase64(blob);
  return `data:application/pdf;base64,${base64}`;
}

function safeName(title: string): string {
  return (title || 'contrat').replace(/[^a-z0-9-_]+/gi, '-').slice(0, 60);
}

/** Envoie par email une copie PDF du document signé (pièce jointe Brevo). */
export async function emailSignedPdf(opts: GenOpts & { to: string; title: string; recipientName?: string }): Promise<void> {
  const blob = await buildSignedPdfBlob(opts);
  const base64 = await blobToBase64(blob);
  const greeting = opts.recipientName ? `Bonjour ${opts.recipientName},<br/>` : '';
  const html = `
  <div style="background:#191E1E;padding:32px 0;font-family:Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#222828;border:1px solid #3A4242;border-radius:12px;">
        <tr><td style="padding:28px 32px;">
          <span style="color:#F3F4F6;font-size:18px;font-weight:700;">CloseOS <span style="color:#CEFF8F;">Sign</span></span>
          <h1 style="color:#fff;font-size:20px;margin:14px 0 8px;">Votre copie signée</h1>
          <p style="color:#A1A9A9;font-size:14px;line-height:1.6;margin:0;">
            ${greeting}Veuillez trouver ci-joint la copie PDF du document signé : <strong style="color:#F3F4F6;">${opts.title}</strong>.<br/>
            Signature sécurisée — conformité RGPD.
          </p>
        </td></tr>
      </table>
    </td></tr></table>
  </div>`;

  const res = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { email: 'support@closeos.fr', name: 'CloseOS Sign' },
      to: [{ email: opts.to }],
      subject: `Copie signée : ${opts.title}`,
      htmlContent: html,
      attachment: [{ content: base64, name: `${safeName(opts.title)}-signe.pdf` }],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Email copie PDF échoué (${res.status}) ${t}`);
  }
}
