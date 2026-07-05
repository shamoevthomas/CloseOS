import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, FileUp, Loader2, X } from 'lucide-react';
import { createContract, updateContract } from '../lib/signContracts';
import { THEMES, CONTRACT_TEMPLATE_HTML, THEME_CSS, type ThemeId } from '../lib/signThemes';
import { useSignLang } from '../contexts/SignLangContext';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

const BASE_CSS = `
  .np-page{position:relative;width:210mm;min-height:297mm;padding:25mm 22mm;background:#fff;color:#1a1a1a;line-height:1.65;box-sizing:border-box;}
  .np-doc h1{font-size:1.6rem;font-weight:700;margin:0 0 .75rem}
  .np-doc h2{font-size:1.2rem;font-weight:700;margin:1.4rem 0 .5rem}
  .np-doc p{margin:.5rem 0}
`;
// Réutilise la même structure mais sous .np-doc pour l'aperçu (mêmes règles que .sign-doc)
const PREVIEW_CSS = THEME_CSS.replace(/\.sign-doc/g, '.np-doc').replace(/theme-/g, 'th-');

export default function SignNewContract() {
  const { lang } = useSignLang();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const contactId = searchParams.get('contact'); // contact à pré-assigner (depuis la fiche contact)
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const create = async (init: { title: string; content_html: string; theme: ThemeId }) => {
    if (busy) return;
    setBusy(true);
    try {
      const id = await createContract(init);
      if (contactId) await updateContract(id, { contact_id: contactId });
      navigate(`/sign/app/contrat/${id}`);
    } catch (e) {
      console.error('[sign] création contrat', e);
      setBusy(false);
    }
  };

  const blank = () => create({ title: lang === 'fr' ? 'Contrat sans titre' : 'Untitled contract', content_html: '<p><br></p>', theme: 'blank' });
  const useTemplate = (id: ThemeId) =>
    create({ title: lang === 'fr' ? 'Contrat de prestation' : 'Service agreement', content_html: CONTRACT_TEMPLATE_HTML, theme: id });

  const importPdf = async (file: File) => {
    if (busy) return;
    if (!file || file.type !== 'application/pdf') return;
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const id = await createContract({ title: file.name.replace(/\.pdf$/i, ''), content_html: '', theme: 'blank' });
      await updateContract(id, { source_type: 'pdf', pdf_data: dataUrl, content_html: null, page_count: 1, ...(contactId ? { contact_id: contactId } : {}) });
      navigate(`/sign/app/contrat/${id}`);
    } catch (err) {
      console.error('[sign] import PDF', err);
      setBusy(false);
    }
  };
  const onPdfFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) importPdf(file);
  };
  const onDropPdf = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) importPdf(file); // importPdf ignore les fichiers non-PDF
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 md:px-10">
      <style>{`${BASE_CSS}\n${PREVIEW_CSS}`}</style>

      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{lang === 'fr' ? 'Nouveau contrat' : 'New contract'}</h1>
          <p className="mt-2 text-sm text-[#A1A9A9]">{lang === 'fr' ? "Partez d'une feuille blanche, importez un PDF, ou choisissez un modèle." : 'Start from a blank page, import a PDF, or pick a template.'}</p>
        </div>
        <button onClick={() => navigate('/sign/app')} className="rounded border border-[#3A4242] p-2 text-[#A1A9A9] transition-colors hover:border-[#A1A9A9] hover:text-white">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Partie haute : blanche / importer */}
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          onClick={blank}
          disabled={busy}
          className="group flex items-center gap-4 rounded-xl border border-[#3A4242] bg-[#222828] p-5 text-left transition-colors hover:border-[#CEFF8F] disabled:opacity-60"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#3A4242] bg-[#191E1E]">
            <FileText className="h-6 w-6 text-[#CEFF8F]" />
          </div>
          <div>
            <div className="font-semibold text-white">{lang === 'fr' ? 'Feuille blanche' : 'Blank page'}</div>
            <div className="text-xs text-[#A1A9A9]">{lang === 'fr' ? 'Rédigez votre contrat de zéro' : 'Write your contract from scratch'}</div>
          </div>
        </button>
        <input ref={pdfInputRef} type="file" accept="application/pdf" className="hidden" onChange={onPdfFile} />
        <button
          onClick={() => pdfInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); if (!busy) setDragging(true); }}
          onDragEnter={(e) => { e.preventDefault(); if (!busy) setDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
          onDrop={onDropPdf}
          disabled={busy}
          className={`group flex items-center gap-4 rounded-xl border bg-[#222828] p-5 text-left transition-colors disabled:opacity-60 ${dragging ? 'border-[#CEFF8F] bg-[#CEFF8F]/5 ring-2 ring-[#CEFF8F]/40' : 'border-[#3A4242] hover:border-[#CEFF8F]'}`}
        >
          <div className={`flex h-12 w-12 items-center justify-center rounded-lg border ${dragging ? 'border-[#CEFF8F] bg-[#CEFF8F]/10' : 'border-[#3A4242] bg-[#191E1E]'}`}>
            <FileUp className="h-6 w-6 text-[#CEFF8F]" />
          </div>
          <div>
            <div className="font-semibold text-white">{lang === 'fr' ? 'Importer un PDF' : 'Import a PDF'}</div>
            <div className="text-xs text-[#A1A9A9]">
              {dragging
                ? (lang === 'fr' ? 'Déposez le PDF ici' : 'Drop the PDF here')
                : (lang === 'fr' ? 'Cliquez ou glissez-déposez un PDF' : 'Click or drag & drop a PDF')}
            </div>
          </div>
        </button>
      </div>

      {/* Partie basse : templates */}
      <div className="mt-9 mb-3 text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">{lang === 'fr' ? 'Modèles' : 'Templates'}</div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {THEMES.map((t) => (
          <button
            key={t.id}
            onClick={() => useTemplate(t.id)}
            disabled={busy}
            className="group overflow-hidden rounded-xl border border-[#3A4242] bg-[#222828] text-left transition-colors hover:border-[#CEFF8F] disabled:opacity-60"
          >
            <div className="relative h-44 overflow-hidden bg-white">
              <div
                className={`np-page np-doc th-${t.id}`}
                style={{ transform: 'scale(0.205)', transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}
                dangerouslySetInnerHTML={{ __html: CONTRACT_TEMPLATE_HTML }}
              />
            </div>
            <div className="flex items-center gap-2 border-t border-[#3A4242] px-3 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.accent }} />
              <span className="truncate text-xs font-medium text-white">{t.name}</span>
            </div>
          </button>
        ))}
      </div>

      {busy && (
        <div className="mt-6 flex items-center gap-2 text-sm text-[#A1A9A9]">
          <Loader2 className="h-4 w-4 animate-spin" /> {lang === 'fr' ? 'Création…' : 'Creating…'}
        </div>
      )}
    </div>
  );
}
