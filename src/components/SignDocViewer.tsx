import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Loader2 } from 'lucide-react';
import type { OverlayImage, SignFreeField } from '../lib/signContracts';
import { PAGED_CSS } from '../lib/signPaging';
import { THEME_CSS } from '../lib/signThemes';
import SignPagedDoc from './SignPagedDoc';
import FillableField from './FillableField';
import { FitPdfPage } from './FitPdfPage';
import { useSignLang } from '../contexts/SignLangContext';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const TARGET_W = 794;

export type SignDocData = {
  title: string;
  sourceType: 'text' | 'pdf';
  contentHtml: string;
  theme: string;
  pdfData: string | null;
  images: OverlayImage[];
  inlineValues: Record<string, string>;
  fields: SignFreeField[];
};

type PdfPage = { width: number; height: number; dataUrl: string };

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(',')[1] ?? '';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function renderPdf(dataUrl: string): Promise<PdfPage[]> {
  const pdf = await pdfjsLib.getDocument({ data: dataUrlToBytes(dataUrl) }).promise;
  const pages: PdfPage[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: TARGET_W / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    pages.push({ width: canvas.width, height: canvas.height, dataUrl: canvas.toDataURL('image/png') });
  }
  return pages;
}

/**
 * Rendu LECTURE SEULE d'un contrat (document + champs libres + valeurs inline + signatures).
 * Réutilise exactement le rendu de la vue signataire (SignPublic) mais sans interaction :
 * tous les champs sont en `readOnly` et les chips inline affichent leur valeur (inlineRole=null).
 * Sert à afficher un modèle ou une instance signée dans l'espace closer / le tableau de bord.
 */
export default function SignDocViewer({ doc }: { doc: SignDocData }) {
  const { lang } = useSignLang();
  const [pdfPages, setPdfPages] = useState<PdfPage[]>([]);
  const docRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (doc.sourceType === 'pdf' && doc.pdfData) {
        try {
          const pages = await renderPdf(doc.pdfData);
          if (!cancelled) setPdfPages(pages);
        } catch (e) {
          console.error('[sign] rendu PDF viewer', e);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc.sourceType, doc.pdfData]);

  const renderFields = (pageNum: number) =>
    doc.fields
      .filter((f) => f.page === pageNum)
      .map((f) => <FillableField key={f.id} field={f} value={f.value ?? ''} onChange={() => {}} readOnly />);

  const renderImages = (pageNum: number) =>
    doc.images
      .filter((im) => im.page === pageNum)
      .map((im) => (
        <img
          key={im.id}
          data-sign-field
          src={im.src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute z-10 select-none object-contain"
          style={{ left: im.x, top: im.y, width: im.w, height: im.h }}
        />
      ));

  return (
    <div className="sign-landing">
      <style>{`
        .sign-landing .sign-page { position:relative; width:210mm; min-height:297mm; padding:25mm 22mm; margin:0 auto;
          background:#fff; color:#1a1a1a; line-height:1.65; box-shadow:0 10px 50px rgba(0,0,0,.5); box-sizing:border-box; }
        .sign-landing .sign-doc { color:#1a1a1a; line-height:1.65; }
        ${PAGED_CSS}
        .sign-landing .sign-doc h1 { font-size:1.6rem; font-weight:700; margin:0 0 .75rem; }
        .sign-landing .sign-doc h2 { font-size:1.2rem; font-weight:700; margin:1.4rem 0 .5rem; }
        .sign-landing .sign-doc p { margin:.5rem 0; }
        .sign-landing .sign-doc ul { list-style:disc; padding-left:1.4rem; margin:.5rem 0; }
        .sign-landing .sign-doc ol { list-style:decimal; padding-left:1.4rem; margin:.5rem 0; }
        .sign-landing .sign-field { display:inline-flex; align-items:center; gap:4px; padding:1px 9px; margin:0 1px; border-radius:9999px;
          border:1px dashed #CEFF8F; background:#191E1E; color:#CEFF8F; font-size:.72em; font-weight:700;
          letter-spacing:.04em; text-transform:uppercase; vertical-align:baseline; white-space:nowrap; }
        .sign-landing .sign-field::before { content:"\\2736"; font-size:.85em; opacity:.8; }
        .sign-landing .sign-field[data-role="owner"] { border-color:#A0E7EC; color:#A0E7EC; }
        ${THEME_CSS}
      `}</style>

      {doc.sourceType === 'pdf' ? (
        <div className="flex flex-col items-center gap-6" ref={docRef}>
          {pdfPages.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-[#A1A9A9]">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> {lang === 'fr' ? 'Rendu du PDF…' : 'Rendering PDF…'}
            </div>
          ) : (
            pdfPages.map((pg, idx) => (
              <FitPdfPage key={idx} width={pg.width} height={pg.height}>
                <img src={pg.dataUrl} width={pg.width} height={pg.height} alt={`Page ${idx + 1}`} />
                {renderImages(idx + 1)}
                {renderFields(idx + 1)}
              </FitPdfPage>
            ))
          )}
        </div>
      ) : (
        <SignPagedDoc
          html={doc.contentHtml}
          docClass={doc.theme && doc.theme !== 'blank' ? `sign-doc theme-${doc.theme}` : 'sign-doc'}
          docElRef={docRef}
          inlineValues={doc.inlineValues}
          inlineRole={null}
        >
          {renderImages(1)}
          {renderFields(1)}
        </SignPagedDoc>
      )}
    </div>
  );
}
