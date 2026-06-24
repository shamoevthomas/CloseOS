import { useEffect, useRef, useState, useCallback, Fragment } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { SignLogo } from '../components/SignLogo';
import { FitPdfPage } from '../components/FitPdfPage';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Heading1,
  Heading2,
  RemoveFormatting,
  Undo2,
  Redo2,
  Type,
  Calendar,
  Clock,
  User,
  Mail,
  Phone,
  MapPin,
  Building2,
  Hash,
  FileDigit,
  Percent,
  Landmark,
  Tag,
  RotateCcw,
  Signature,
  ChevronLeft,
  CheckCircle2,
  Lock,
  Pencil,
  Send,
  X,
  FileText,
  GripVertical,
  Move,
  FileUp,
  Image as ImageIcon,
  Palette,
  Highlighter,
  ALargeSmall,
  ListPlus,
  Loader2,
  Trash2,
  Copy,
  Link as LinkIcon,
  PenLine,
  Download,
  Eye,
  Users,
  ShieldCheck,
  Settings,
  Unlock,
  CopyPlus,
  Plus,
  Minus,
  CreditCard,
  Files,
  LayoutDashboard,
} from 'lucide-react';
import { currentOwnerId } from '../lib/signAuth';
import { createContract, getContract, updateContract, saveFreeFields, fieldDefaultSize, listContacts, listContactGroups, getContractAnalytics, getOwnerProfile, getOwnerStripeStatus, duplicateContract, listSigners, setSignerCount, updateSigner, setSignerContact, getOrCreateSignLinkForSigner, sendForSignatureMulti, type SignContact, type SignContactGroup, type OverlayImage, type SignAnalytics, type OwnerProfile, type SignSigner } from '../lib/signContracts';
import { signSupabase as supabase } from '../lib/signSupabase';
import VerificationStyleModal, { type VerifMethod, type SignerWL } from '../components/VerificationStyleModal';
import PaymentConfigModal, { type PaymentDraft, type PayerScope } from '../components/PaymentConfigModal';
import { fieldColor, signerColor, signChipCss, MAX_SIGNERS } from '../lib/signColors';
import FillableField from '../components/FillableField';
import ContactPicker from '../components/ContactPicker';
import ToolbarMenu from '../components/ToolbarMenu';
import ColorPalette from '../components/ColorPalette';
import { THEME_CSS, newArticleHtml } from '../lib/signThemes';

const FONT_SIZES = [12, 14, 16, 18, 24, 32];
import { emailSignedPdf, buildSignedPdfBlob, buildSignedPdfDataUri } from '../lib/signPdfExport';
import { generateCertificate, getCertificateUrl } from '../lib/signCertificate';
import { isValidEmail, CHECKBOX_DEFAULT_TEXT, todayLocalISO, nowLocalHM, isSignatureType } from '../lib/signFieldsMeta';
import { PG_H, PG_GAP, paginateEl, PAGED_CSS } from '../lib/signPaging';
import SignPagedDoc from '../components/SignPagedDoc';
import SignSubscriptionPanel from '../components/SignSubscriptionPanel';
import { parseInlineFields } from '../lib/signInline';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/**
 * CloseOS Sign — Éditeur de contrat (DA Sign).
 * Deux sources :
 *  - 'text' : feuille A4 éditable (clic = champ inline, drag = inline/libre)
 *  - 'pdf'  : PDF importé (rendu pdf.js) ; SEULS les champs en drag & drop (libres) marchent.
 * Persistance Supabase (tables sign_*).
 */

const TARGET_W = 794; // largeur de rendu (≈ A4 210mm @96dpi)

// Palette regroupée par logique (signature/accord → coordonnées → entreprise → date & lieu → divers)
const FIELD_GROUPS = [
  {
    title: 'Signature & accord',
    items: [
      { type: 'signature', label: 'Signature', icon: Signature },
    ],
  },
  {
    title: 'Coordonnées',
    items: [
      { type: 'name', label: 'Nom complet', icon: User },
      { type: 'email', label: 'Email', icon: Mail },
      { type: 'tel', label: 'Téléphone', icon: Phone },
      { type: 'address', label: 'Adresse complète', icon: MapPin },
    ],
  },
  {
    title: 'Entreprise',
    items: [
      { type: 'siret', label: 'SIRET', icon: FileDigit },
      { type: 'siren', label: 'SIREN', icon: Hash },
      { type: 'tva', label: 'N° de TVA', icon: Percent },
      { type: 'company_id', label: "N° d'entreprise", icon: Landmark },
      { type: 'ape', label: 'Code APE/NAF', icon: Tag },
    ],
  },
  {
    title: 'Date & lieu',
    items: [
      { type: 'date', label: 'Date', icon: Calendar },
      { type: 'time', label: 'Heure', icon: Clock },
      { type: 'city', label: 'Lieu de signature', icon: Building2 },
    ],
  },
  {
    title: 'Divers',
    items: [{ type: 'text', label: 'Texte libre', icon: Type }],
  },
] as const;

const FIELD_TYPES = FIELD_GROUPS.flatMap((g) => g.items);

const FIELD_META: Record<string, { label: string; Icon: typeof User }> = Object.fromEntries(
  FIELD_TYPES.map((f) => [f.type, { label: f.label, Icon: f.icon }]),
);
const FIELD_LABELS: Record<string, string> = Object.fromEntries(FIELD_TYPES.map((f) => [f.type, f.label]));
// Legacy : anciens champs "initials" rendus comme une signature
FIELD_META.initials = FIELD_META.signature;
FIELD_LABELS.initials = FIELD_LABELS.signature;
const buildChip = (type: string, role: string, signerIndex: number) =>
  `<span class="sign-field" data-field="${type}" data-role="${role}"${role === 'signer' ? ` data-signer="${signerIndex}"` : ''} contenteditable="false">${FIELD_LABELS[type]}</span>&nbsp;`;

function caretRangeFromPoint(x: number, y: number): Range | null {
  const doc = document as any;
  if (doc.caretRangeFromPoint) return doc.caretRangeFromPoint(x, y);
  if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(x, y);
    if (!pos) return null;
    const r = document.createRange();
    r.setStart(pos.offsetNode, pos.offset);
    r.collapse(true);
    return r;
  }
  return null;
}

const DND_MIME = 'application/x-sign-field';

type Role = 'owner' | 'signer';
type Field = { id: string; type: string; x: number; y: number; w: number; h: number; page: number; role: Role; signerIndex?: number | null; label: string; value?: string };
type PdfPage = { width: number; height: number; dataUrl: string };

// Document vierge à la création (feuille blanche, sans modèle)
const DEFAULT_DOC = '<p><br></p>';

let idSeq = 0;
const newId = () => `f_${Date.now().toString(36)}_${idSeq++}`;

/** Copie un texte dans le presse-papier, avec repli (contexte non sécurisé : http://IP en LAN). */
async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* repli ci-dessous */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

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
    const scale = TARGET_W / base.width;
    const viewport = page.getViewport({ scale });
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

export default function SignContractEditor() {
  const navigate = useNavigate();
  const params = useParams();
  const paramId = params.id;

  const editorRef = useRef<HTMLDivElement>(null);
  const textPageRef = useRef<HTMLDivElement>(null);
  const pdfPageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const savedRange = useRef<Range | null>(null);
  const pgTimer = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('Contrat sans titre');
  const [fields, setFields] = useState<Field[]>([]);
  const [inlineCount, setInlineCount] = useState(0);
  const [inlineSigCount, setInlineSigCount] = useState(0);
  const [validated, setValidated] = useState(false);
  const [validatedHtml, setValidatedHtml] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [showTitlePrompt, setShowTitlePrompt] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [duplicating, setDuplicating] = useState(false);
  const [dropGhost, setDropGhost] = useState<{ page: number; mode: 'inline' | 'free'; x: number; y: number; h?: number } | null>(null);
  const [contractId, setContractId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(0);
  const [sourceType, setSourceType] = useState<'text' | 'pdf'>('text');
  const [pdfPages, setPdfPages] = useState<PdfPage[]>([]);
  const [importing, setImporting] = useState(false);
  const [theme, setTheme] = useState('blank');
  const [pageCount, setPageCount] = useState(1);
  const [analytics, setAnalytics] = useState<SignAnalytics | null>(null);
  const [inlineValues, setInlineValues] = useState<Record<string, string>>({});
  const inlineValuesRef = useRef<Record<string, string>>({});
  inlineValuesRef.current = inlineValues;
  const inlineHydrated = useRef(false);
  const [inlineFields, setInlineFields] = useState<ReturnType<typeof parseInlineFields>>([]);
  const [inlineResetKey, setInlineResetKey] = useState(0);
  const setInlineValue = (fid: string, v: string) => setInlineValues((prev) => ({ ...prev, [fid]: v }));
  const [placeFor, setPlaceFor] = useState<Role>('signer');
  const [placeSignerIndex, setPlaceSignerIndex] = useState(1); // signataire ciblé quand placeFor='signer'
  const placeSignerIndexRef = useRef(1);
  placeSignerIndexRef.current = placeSignerIndex;
  const [signers, setSigners] = useState<SignSigner[]>([]);
  const signersRef = useRef<SignSigner[]>([]);
  signersRef.current = signers;
  const [signerCount, setSignerCountState] = useState(1);
  const [signingOrder, setSigningOrder] = useState<'parallel' | 'sequential'>('parallel');
  const [showOrderMenu, setShowOrderMenu] = useState(false);
  const orderMenuRef = useRef<HTMLDivElement>(null);
  const [editLabelId, setEditLabelId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<SignContact[]>([]);
  const [groups, setGroups] = useState<SignContactGroup[]>([]);
  const [images, setImages] = useState<OverlayImage[]>([]);
  const imagesRef = useRef<OverlayImage[]>([]);
  imagesRef.current = images;
  const [selImg, setSelImg] = useState<{ kind: 'free' | 'inline'; id?: string } | null>(null);
  const [bubblePos, setBubblePos] = useState<{ x: number; y: number } | null>(null);
  const selInlineElRef = useRef<HTMLElement | null>(null);
  const [chipMenu, setChipMenu] = useState<{ el: HTMLElement; x: number; y: number; role: string } | null>(null);
  const chipMenuRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [fmtBar, setFmtBar] = useState<{ x: number; y: number } | null>(null);
  const fmtBubbleRef = useRef<HTMLDivElement>(null);
  const [showOwnerPrompt, setShowOwnerPrompt] = useState(false);
  const [fillMode, setFillMode] = useState(false);
  const [savingFill, setSavingFill] = useState(false);
  const [status, setStatus] = useState('draft');
  const [isTemplate, setIsTemplate] = useState(false);
  const docRef = useRef<HTMLDivElement>(null);
  const [showSendPdf, setShowSendPdf] = useState(false);
  const [pdfEmail, setPdfEmail] = useState('');
  const [pdfSending, setPdfSending] = useState(false);
  const [pdfSent, setPdfSent] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [certBusy, setCertBusy] = useState(false);
  // Envoi pour signature (multi-signataire)
  const [showSend, setShowSend] = useState(false);
  const [sendRows, setSendRows] = useState<{ signerIndex: number; name: string; email: string }[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sentLinks, setSentLinks] = useState<{ signerIndex: number; link: string }[]>([]);
  // Popup « copier le lien » (un lien par signataire)
  const [showLinks, setShowLinks] = useState(false);
  const [headerLinks, setHeaderLinks] = useState<{ signerIndex: number; link: string }[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  // Vérification d'identité — méthode GLOBALE au contrat ; whitelists PAR signataire (sur chaque ligne signers)
  const [verificationMethod, setVerificationMethod] = useState<VerifMethod>('none');
  const [stripeConnected, setStripeConnected] = useState(false);
  const [showVerifModal, setShowVerifModal] = useState(false);
  const verifPromptedRef = useRef(false); // pop-up proposé une seule fois (au 1er champ signature)
  const [sigBubbleId, setSigBubbleId] = useState<string | null>(null); // champ signature sélectionné → bulle ⚙️
  // Paiement — axe INDÉPENDANT de la vérification
  const [paymentEnabled, setPaymentEnabled] = useState(false);
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft | null>(null);
  const [payerScope, setPayerScope] = useState<PayerScope>('all');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  // Verrou de vérif : agrégé sur l'ensemble des signataires (au moins un bloqué)
  const [unlocking, setUnlocking] = useState(false);
  const lockedSigner = signers.find((s) => s.verificationLocked) ?? null;
  const verificationLocked = !!lockedSigner;
  const verificationLockStep = lockedSigner?.verificationLockStep ?? null;

  const contractIdRef = useRef<string | null>(null);
  const titleRef = useRef(title);
  const fieldsRef = useRef<Field[]>(fields);
  const sourceTypeRef = useRef(sourceType);
  const statusRef = useRef(status);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollTopView = () => requestAnimationFrame(() => scrollAreaRef.current?.scrollTo({ top: 0 }));

  const persist = useCallback(() => setDirty((d) => d + 1), []);

  const surfaceEl = useCallback(
    (page: number): HTMLDivElement | null =>
      sourceTypeRef.current === 'pdf' ? pdfPageRefs.current[page] ?? null : textPageRef.current,
    [],
  );

  // ---- Chargement / création ----
  useEffect(() => {
    document.title = 'Éditer un contrat | CloseOS Sign';
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        if (!(await currentOwnerId())) {
          if (!cancelled) navigate('/sign/login', { replace: true });
          return;
        }
        if (paramId) {
          const data = await getContract(paramId);
          if (cancelled) return;
          if (!data) {
            navigate('/sign/app/contrats', { replace: true });
            return;
          }
          setTitle(data.title);
          setFields(data.fields);
          setSourceType(data.source_type);
          setStatus(data.status);
          setTheme(data.theme || 'blank');
          setValidatedHtml(data.content_html || '');
          if (data.source_type === 'pdf' && data.pdf_data) {
            try {
              setPdfPages(await renderPdf(data.pdf_data));
            } catch (e) {
              console.error('[sign] rendu PDF', e);
            }
          } else if (editorRef.current) {
            editorRef.current.innerHTML = data.content_html || DEFAULT_DOC;
            countInline();
            schedulePaginate();
          }
          setInlineValues(data.inline_values || {});
          setInlineFields(parseInlineFields(data.content_html || ''));
          setContractId(data.id);
          setImages(data.images || []);
          // Multi-signataire
          setSigners(data.signers);
          setSignerCountState(data.signer_count || 1);
          setSigningOrder(data.signing_order || 'parallel');
          setVerificationMethod(data.verification_method === 'pay' ? 'none' : data.verification_method);
          setPaymentEnabled(!!data.payment_enabled);
          setIsTemplate(!!data.is_template);
          setPaymentDraft(
            data.payment.mode
              ? { mode: data.payment.mode, amount: data.payment.amount ?? 0, interval: data.payment.interval ?? 'month', durationMonths: data.payment.durationMonths, trialDays: data.payment.trialDays, tvaRate: data.payment.tvaRate }
              : null,
          );
          const payers = data.signers.filter((s) => s.paymentRequired);
          setPayerScope(payers.length === 0 || payers.length === data.signers.length ? 'all' : payers.length === 1 ? payers[0].signerIndex : 'all');
          getOwnerStripeStatus().then((s) => setStripeConnected(s.connected)).catch(() => {});
          // Ne PAS reproposer le pop-up si une méthode est déjà choisie ou si une signature existe déjà.
          verifPromptedRef.current =
            data.verification_method !== 'none' ||
            data.fields.some((f) => f.type === 'signature' || f.type === 'initials') ||
            /data-field="(signature|initials)"/.test(data.content_html || '');
          if (data.locked) setValidated(true); // restaure l'état verrouillé au refresh
        } else {
          const id = await createContract({ title: 'Contrat sans titre', content_html: DEFAULT_DOC });
          if (cancelled) return;
          if (editorRef.current) editorRef.current.innerHTML = DEFAULT_DOC;
          setInlineCount(0);
          setContractId(id);
          navigate(`/sign/app/contrat/${id}`, { replace: true });
        }
      } catch (e) {
        console.error('[sign] chargement/création contrat', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paramId, navigate]);

  // ---- Autosave debouncé ----
  useEffect(() => {
    const cid = contractIdRef.current;
    if (!cid) return;
    const t = setTimeout(() => {
      // Une fois le contrat envoyé/signé, le PROPRIÉTAIRE ne doit plus réécrire les champs ni les
      // valeurs : sinon saveFreeFields (delete+insert) et inline_values ÉCRASENT ce que le
      // signataire a rempli. On ne sauvegarde alors que le titre.
      const locked = statusRef.current === 'sent' || statusRef.current === 'signed' || statusRef.current === 'paid';
      const patch: any = { title: titleRef.current };
      if (!locked) {
        patch.images = imagesRef.current;
        patch.inline_values = inlineValuesRef.current;
        // En mode édition seulement (editorRef présent), on met à jour le HTML propre.
        // En vue validée/remplissage, editorRef est absent → on NE TOUCHE PAS au content_html figé.
        if (sourceTypeRef.current === 'text' && editorRef.current) patch.content_html = getCleanHtml();
      }
      updateContract(cid, patch).catch((e) => console.error('[sign] save contrat', e));
      if (!locked) saveFreeFields(cid, fieldsRef.current).catch((e) => console.error('[sign] save champs', e));
    }, 700);
    return () => clearTimeout(t);
  }, [dirty]);

  // Bascule « mode modèle » (template réutilisable) — persiste immédiatement.
  const toggleTemplate = () => {
    const next = !isTemplate;
    setIsTemplate(next);
    const cid = contractIdRef.current;
    if (cid) updateContract(cid, { is_template: next }).catch((e) => console.error('[sign] mode template', e));
  };

  // Persiste les valeurs inline dès qu'elles changent (préremplissage + frappe)
  useEffect(() => {
    if (!inlineHydrated.current) {
      inlineHydrated.current = true; // 1er passage = valeurs chargées, pas besoin de re-sauver
      return;
    }
    if (contractIdRef.current) persist();
  }, [inlineValues]);

  // Chargement des contacts (pour le préremplissage)
  useEffect(() => {
    listContacts()
      .then(setContacts)
      .catch((e) => console.error('[sign] contacts', e));
    listContactGroups().then(setGroups).catch(() => {});
  }, []);

  // Suivi du lien (vues / personnes) une fois le contrat validé
  useEffect(() => {
    if (!validated || !contractId) return;
    getContractAnalytics(contractId)
      .then(setAnalytics)
      .catch((e) => console.error('[sign] analytics', e));
  }, [validated, contractId, status]);

  // Ferme la bulle "champ inline" au clic extérieur / au scroll
  useEffect(() => {
    if (!chipMenu) return;
    const onDown = (ev: MouseEvent) => {
      if (chipMenuRef.current?.contains(ev.target as Node)) return;
      if ((ev.target as HTMLElement)?.closest?.('.sign-field')) return; // clic sur un autre chip → géré par onEditorClick
      setChipMenu(null);
    };
    const onScroll = () => setChipMenu(null);
    document.addEventListener('mousedown', onDown, true);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [chipMenu]);

  // Ferme la bulle image au clic extérieur / au scroll
  useEffect(() => {
    if (!selImg) return;
    const onDown = (ev: MouseEvent) => {
      if (bubbleRef.current && bubbleRef.current.contains(ev.target as Node)) return;
      setSelImg(null);
      setBubblePos(null);
      selInlineElRef.current = null;
    };
    const onScroll = () => {
      setSelImg(null);
      setBubblePos(null);
      selInlineElRef.current = null;
    };
    document.addEventListener('mousedown', onDown, true);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [selImg]);

  // Ferme la bulle ⚙️ (vérification) du champ signature au clic extérieur / au scroll
  useEffect(() => {
    if (!sigBubbleId) return;
    const onDown = (ev: MouseEvent) => {
      const t = ev.target as HTMLElement;
      if (t.closest('.sig-bubble')) return; // clic dans la bulle
      if (t.closest(`[data-sigfield="${sigBubbleId}"]`)) return; // clic sur le champ sélectionné (géré au mouseup)
      setSigBubbleId(null);
    };
    const onScroll = () => setSigBubbleId(null);
    document.addEventListener('mousedown', onDown, true);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [sigBubbleId]);

  // (Re)pagine quand le mode change, et au redimensionnement de la fenêtre
  useEffect(() => {
    if (sourceType !== 'text' || validated || fillMode) return;
    schedulePaginate();
    const onResize = () => schedulePaginate();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceType, validated, fillMode, loading]);

  // Ferme la barre de mise en forme au clic hors éditeur/barre, ou au scroll
  useEffect(() => {
    if (!fmtBar) return;
    const onDown = (ev: MouseEvent) => {
      const t = ev.target as Node;
      if (fmtBubbleRef.current?.contains(t)) return;
      if (editorRef.current?.contains(t)) return;
      setFmtBar(null);
    };
    const onScroll = () => setFmtBar(null);
    document.addEventListener('mousedown', onDown, true);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [fmtBar]);

  // Préremplit les champs du SIGNATAIRE SÉLECTIONNÉ depuis un contact (sauf signature/nom/ville/date/heure)
  const prefillFromContact = (c: SignContact) => {
    const idx = placeSignerIndexRef.current;
    const signer = signersRef.current.find((s) => s.signerIndex === idx);
    if (signer) {
      setSigners((prev) => prev.map((s) => (s.id === signer.id ? { ...s, contactId: c.id, name: c.name, email: c.email, phone: c.phone } : s)));
      setSignerContact(signer.id, { id: c.id, name: c.name, email: c.email, phone: c.phone }).catch((e) => console.error('[sign] assign contact signataire', e));
    }
    setFields((prev) =>
      prev.map((f) => {
        if (f.role !== 'signer' || (f.signerIndex ?? 1) !== idx) return f;
        let v = '';
        if (f.type === 'email') v = c.email;
        else if (f.type === 'tel') v = c.phone;
        else if (f.type === 'address') v = c.address;
        else if (f.type === 'siret') v = c.siret ?? '';
        else if (f.type === 'siren') v = c.siren ?? '';
        else if (f.type === 'tva') v = c.tva ?? '';
        else if (f.type === 'company_id') v = c.company_id ?? '';
        else if (f.type === 'ape') v = c.ape ?? '';
        else return f; // signature, nom, ville+pays, date, heure, texte libre → non préremplis
        return v ? { ...f, value: v } : f;
      }),
    );
    persist();
  };

  // ---- Texte : mise en forme + curseur ----
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  };
  const countInline = () => {
    const el = editorRef.current;
    setInlineCount(el?.querySelectorAll('.sign-field').length ?? 0);
    setInlineSigCount(el?.querySelectorAll('.sign-field[data-field="signature"], .sign-field[data-field="initials"]').length ?? 0);
  };

  // innerHTML de l'éditeur SANS les sauts de page (espaceurs purement visuels)
  const getCleanHtml = (): string => {
    const el = editorRef.current;
    if (!el) return '';
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.pg-break').forEach((n) => n.remove());
    return clone.innerHTML;
  };

  // Pagination "type Google Docs" : pousse chaque bloc qui déborde sur la page A4 suivante
  // (sans couper les blocs), via des espaceurs non éditables. Met à jour le nombre de feuilles.
  const paginate = () => {
    const el = editorRef.current;
    if (!el || sourceTypeRef.current !== 'text') return;
    setPageCount(paginateEl(el));
  };

  const schedulePaginate = () => {
    if (pgTimer.current) window.clearTimeout(pgTimer.current);
    pgTimer.current = window.setTimeout(paginate, 100);
  };

  // Barre de mise en forme flottante : affichée au-dessus d'une sélection de texte
  const updateFmtBar = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !editorRef.current?.contains(sel.anchorNode)) {
      setFmtBar(null);
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      setFmtBar(null);
      return;
    }
    setFmtBar({ x: rect.left + rect.width / 2, y: rect.top });
  };

  const insertFieldInline = (type: string) => {
    maybePromptVerif(type);
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      if (savedRange.current && editor.contains(savedRange.current.startContainer)) {
        sel.addRange(savedRange.current);
      } else {
        const r = document.createRange();
        r.selectNodeContents(editor);
        r.collapse(false);
        sel.addRange(r);
      }
    }
    document.execCommand('insertHTML', false, buildChip(type, placeFor, placeSignerIndexRef.current));
    saveSelection();
    countInline();
    persist();
  };
  const exec = (cmd: string, arg?: string) => {
    const editor = editorRef.current;
    editor?.focus();
    // restaure la sélection si l'éditeur l'a perdue (nécessaire pour undo/redo & formats)
    const sel = window.getSelection();
    if (editor && sel && (sel.rangeCount === 0 || !editor.contains(sel.anchorNode)) && savedRange.current && editor.contains(savedRange.current.startContainer)) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    document.execCommand(cmd, false, arg);
    saveSelection();
    persist();
  };

  const restoreSelection = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    if (sel && savedRange.current && editor.contains(savedRange.current.startContainer)) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  };

  const applyColor = (color: string) => {
    restoreSelection();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('foreColor', false, color);
    document.execCommand('styleWithCSS', false, 'false');
    saveSelection();
    persist();
  };

  const applyHighlight = (color: string) => {
    restoreSelection();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('hiliteColor', false, color);
    document.execCommand('styleWithCSS', false, 'false');
    saveSelection();
    persist();
  };

  const applyFontSize = (px: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    if (sel && savedRange.current && editor.contains(savedRange.current.startContainer)) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    const s = window.getSelection();
    if (!s || s.isCollapsed) return;
    // astuce : font size 7 puis remplacement par une taille px réelle
    document.execCommand('fontSize', false, '7');
    editor.querySelectorAll('font[size="7"]').forEach((f) => {
      const el = f as HTMLElement;
      el.removeAttribute('size');
      el.style.fontSize = `${px}px`;
    });
    saveSelection();
    persist();
  };

  // Ajoute un article (reproduit la DA) juste APRÈS le bloc où se trouve le curseur
  const addArticle = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();

    // Position du curseur : sélection live, sinon range mémorisé
    let anchor: Node | null = sel && editor.contains(sel.anchorNode) ? sel.anchorNode : null;
    if (!anchor && savedRange.current && editor.contains(savedRange.current.startContainer)) {
      sel?.removeAllRanges();
      sel?.addRange(savedRange.current);
      anchor = savedRange.current.startContainer;
    }

    // Remonte jusqu'au bloc enfant direct de l'éditeur
    let block: HTMLElement | null = null;
    if (anchor) {
      let el: HTMLElement | null = anchor.nodeType === 3 ? anchor.parentElement : (anchor as HTMLElement);
      while (el && el.parentElement && el.parentElement !== editor) el = el.parentElement;
      if (el && el.parentElement === editor) block = el;
    }

    const div = document.createElement('div');
    div.innerHTML = newArticleHtml(1);
    const node = div.firstElementChild as HTMLElement | null;
    if (!node) return;

    if (block) block.after(node);
    else editor.appendChild(node);

    // Renumérote tous les articles dans l'ordre du document
    editor.querySelectorAll('.art .num').forEach((el, i) => {
      el.textContent = String(i + 1);
    });

    // Curseur dans le corps du nouvel article
    const r = document.createRange();
    r.selectNodeContents(node.querySelector('.art-b') || node);
    r.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(r);
    node.scrollIntoView({ block: 'center' });
    saveSelection();
    persist();
    schedulePaginate();
  };

  // ---- Images (mode choisi via une bulle au clic sur l'image) ----
  const inlineImgHtml = (src: string, w: number) =>
    `<span class="sign-img" style="display:inline-block;width:${Math.round(w)}px;max-width:100%;resize:horizontal;overflow:hidden;vertical-align:bottom;line-height:0;"><img src="${src}" alt="" style="width:100%;height:auto;display:block;" /></span>&nbsp;`;

  const onImageClick = () => imageInputRef.current?.click();

  const addOverlayImage = (dataUrl: string) => {
    const probe = new Image();
    probe.onload = () => {
      const ar = probe.naturalWidth && probe.naturalHeight ? probe.naturalWidth / probe.naturalHeight : 1;
      const w = Math.min(280, probe.naturalWidth || 280);
      const h = w / ar;
      const el = surfaceEl(1);
      const x = el ? Math.max(0, el.clientWidth / 2 - w / 2) : 80;
      const y = 140;
      const id = newId();
      setImages((prev) => [...prev, { id, page: 1, x, y, w, h, src: dataUrl }]);
      persist();
      // sélectionne la nouvelle image et ouvre la bulle juste en dessous
      const pr = el?.getBoundingClientRect();
      selInlineElRef.current = null;
      setSelImg({ kind: 'free', id });
      if (pr) setBubblePos({ x: pr.left + x, y: pr.top + y + h });
    };
    probe.src = dataUrl;
  };

  const onImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    const fr = new FileReader();
    fr.onload = () => addOverlayImage(fr.result as string);
    fr.readAsDataURL(file);
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((im) => im.id !== id));
    persist();
  };

  const closeImgBubble = () => {
    setSelImg(null);
    setBubblePos(null);
    selInlineElRef.current = null;
  };

  // Sélection d'une image LIBRE → bulle
  const selectFreeImage = (e: React.MouseEvent, im: OverlayImage) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    selInlineElRef.current = null;
    setSelImg({ kind: 'free', id: im.id });
    setBubblePos({ x: rect.left, y: rect.bottom });
  };

  // Clic dans l'éditeur : image INLINE → bulle ; sinon ferme
  const onEditorClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    // Clic sur un champ inline → bulle (changer le rôle / supprimer)
    const chip = t.closest('.sign-field') as HTMLElement | null;
    if (chip && editorRef.current?.contains(chip)) {
      const rect = chip.getBoundingClientRect();
      setChipMenu({ el: chip, x: rect.left, y: rect.bottom, role: chip.getAttribute('data-role') || 'signer' });
      closeImgBubble();
      return;
    }
    setChipMenu(null);
    const el = (t.closest('.sign-img') as HTMLElement | null) || (t.tagName === 'IMG' ? t : null);
    if (el && editorRef.current?.contains(el)) {
      selInlineElRef.current = el;
      const rect = el.getBoundingClientRect();
      setSelImg({ kind: 'inline' });
      setBubblePos({ x: rect.left, y: rect.bottom });
    } else {
      closeImgBubble();
    }
  };

  const setChipRole = (role: 'owner' | 'signer') => {
    if (!chipMenu) return;
    chipMenu.el.setAttribute('data-role', role);
    if (role === 'signer') chipMenu.el.setAttribute('data-signer', String(placeSignerIndexRef.current));
    else chipMenu.el.removeAttribute('data-signer');
    setChipMenu({ ...chipMenu, role });
    countInline();
    persist();
  };

  const deleteChip = () => {
    if (!chipMenu) return;
    // retire aussi l'espace insécable qui suit éventuellement le champ
    const next = chipMenu.el.nextSibling;
    if (next && next.nodeType === 3 && (next.textContent === ' ' || next.textContent === ' ')) next.parentNode?.removeChild(next);
    chipMenu.el.remove();
    setChipMenu(null);
    countInline();
    persist();
    schedulePaginate();
  };

  // Conversions de mode
  const freeToInline = () => {
    if (selImg?.kind !== 'free' || !selImg.id) return;
    const im = images.find((i) => i.id === selImg.id);
    if (!im) return;
    setImages((prev) => prev.filter((i) => i.id !== im.id));
    const editor = editorRef.current;
    if (editor) {
      editor.focus();
      const r = document.createRange();
      r.selectNodeContents(editor);
      r.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(r);
      document.execCommand('insertHTML', false, inlineImgHtml(im.src, im.w));
      saveSelection();
    }
    persist();
    closeImgBubble();
  };

  const inlineToFree = () => {
    const el = selInlineElRef.current;
    if (!el) return;
    const img = (el.tagName === 'IMG' ? el : el.querySelector('img')) as HTMLImageElement | null;
    const src = img?.getAttribute('src') || '';
    if (!src) return;
    const page = surfaceEl(1);
    const pr = page?.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const w = el.offsetWidth || 280;
    const h = el.offsetHeight || w * 0.6;
    const x = pr && page ? Math.max(0, Math.min(page.clientWidth - w, rect.left - pr.left)) : 60;
    const y = pr ? Math.max(0, rect.top - pr.top) : 120;
    const next = el.nextSibling;
    el.remove();
    if (next && next.nodeType === 3 && (next.textContent === ' ' || next.textContent === ' ')) next.parentNode?.removeChild(next);
    persist();
    setImages((prev) => [...prev, { id: newId(), page: 1, x, y, w, h, src }]);
    persist();
    closeImgBubble();
  };

  const deleteSelectedImage = () => {
    if (selImg?.kind === 'free' && selImg.id) removeImage(selImg.id);
    else if (selImg?.kind === 'inline' && selInlineElRef.current) {
      selInlineElRef.current.remove();
      persist();
    }
    closeImgBubble();
  };

  // ---- Champs libres (overlay) ----
  // Au 1er champ signature posé → propose le pop-up « Style de vérification » (une seule fois).
  const maybePromptVerif = (type: string) => {
    if (!isSignatureType(type) || verifPromptedRef.current) return;
    const hadSignature = fieldsRef.current.some((f) => isSignatureType(f.type)) || inlineSigCount > 0;
    verifPromptedRef.current = true;
    if (!hadSignature) setShowVerifModal(true);
  };

  // Débloque l'accès signataire (réinitialise compteurs + état de blocage) — pour chaque signataire bloqué.
  const unlockVerification = async () => {
    const locked = signersRef.current.filter((s) => s.verificationLocked);
    if (!locked.length) return;
    setUnlocking(true);
    try {
      await Promise.all(
        locked.map((s) =>
          supabase
            .from('sign_contract_signers')
            .update({ verification_locked: false, verification_lock_reason: null, verification_lock_step: null, verification_dest_attempts: 0, verification_code_attempts: 0 })
            .eq('id', s.id),
        ),
      );
      setSigners((prev) => prev.map((s) => (s.verificationLocked ? { ...s, verificationLocked: false, verificationLockReason: null, verificationLockStep: null } : s)));
    } catch (e) {
      console.error('[sign] déblocage', e);
    } finally {
      setUnlocking(false);
    }
  };

  // Lance l'onboarding Stripe Connect du proprio (redirection).
  const onConnectStripe = async () => {
    try {
      const { data } = await supabase.functions.invoke('sign-pay', {
        body: { action: 'connect', ownerId: await currentOwnerId(), origin: window.location.origin },
      });
      if (data?.url) window.location.href = data.url as string;
      else window.alert('Connexion Stripe indisponible (clé Stripe non configurée ?).');
    } catch {
      window.alert('Connexion Stripe impossible.');
    }
  };

  // Confirmation vérif : méthode GLOBALE au contrat + whitelists PAR signataire.
  const onVerifConfirm = async ({ method, signers: wl }: { method: Exclude<VerifMethod, 'pay'>; signers: SignerWL[] }) => {
    setVerificationMethod(method);
    setShowVerifModal(false);
    const cid = contractIdRef.current;
    if (!cid) return;
    try {
      await updateContract(cid, { verification_method: method });
      await Promise.all(
        wl.map((w) => {
          const signer = signersRef.current.find((s) => s.signerIndex === w.index);
          if (!signer) return Promise.resolve();
          return updateSigner(signer.id, {
            verificationEmails: method === 'email' ? w.emails : [],
            verificationPhones: method === 'sms' ? w.phones : [],
            verificationPairs: method === 'email_sms' ? w.pairs : [],
          });
        }),
      );
      setSigners((prev) =>
        prev.map((s) => {
          const w = wl.find((x) => x.index === s.signerIndex);
          if (!w) return s;
          return {
            ...s,
            verificationEmails: method === 'email' ? w.emails : [],
            verificationPhones: method === 'sms' ? w.phones : [],
            verificationPairs: method === 'email_sms' ? w.pairs : [],
          };
        }),
      );
    } catch (e) {
      console.error('[sign] save vérification', e);
    }
  };

  // Confirmation paiement (axe indépendant) : config globale + payment_required par signataire.
  const onPaymentConfirm = async ({ enabled, payment, payerScope: scope }: { enabled: boolean; payment: PaymentDraft | null; payerScope: PayerScope }) => {
    setPaymentEnabled(enabled);
    setPaymentDraft(payment);
    setPayerScope(scope);
    setShowPaymentModal(false);
    const cid = contractIdRef.current;
    if (!cid) return;
    const pay = enabled ? payment : null;
    try {
      await updateContract(cid, {
        payment_enabled: enabled,
        payment_mode: pay ? pay.mode : null,
        payment_amount: pay ? pay.amount : null,
        payment_interval: pay ? pay.interval : null,
        payment_duration_months: pay ? pay.durationMonths : null,
        payment_trial_days: pay ? pay.trialDays : 0,
        payment_tva_rate: pay ? pay.tvaRate : null,
      });
      const isPayer = (idx: number) => enabled && (scope === 'all' || scope === idx);
      await Promise.all(signersRef.current.map((s) => updateSigner(s.id, { paymentRequired: isPayer(s.signerIndex) })));
      setSigners((prev) => prev.map((s) => ({ ...s, paymentRequired: isPayer(s.signerIndex) })));
    } catch (e) {
      console.error('[sign] save paiement', e);
    }
  };

  // Change le nombre de signataires (crée/supprime les lignes + champs des signataires retirés).
  const changeSignerCount = async (n: number) => {
    const next = Math.max(1, Math.min(MAX_SIGNERS, n));
    if (next === signerCount) return;
    const cid = contractIdRef.current;
    if (!cid) return;
    // À la baisse : confirmation si des champs appartiennent aux signataires retirés
    if (next < signerCount) {
      const lost = fieldsRef.current.some((f) => f.role === 'signer' && (f.signerIndex ?? 1) > next) || inlineFields.some((f) => f.role === 'signer' && f.signerIndex > next);
      if (lost && !window.confirm(`Réduire à ${next} signataire${next > 1 ? 's' : ''} supprimera les champs des signataires retirés. Continuer ?`)) return;
      // Nettoie les champs libres + inline des signataires au-delà de next
      setFields((prev) => prev.filter((f) => !(f.role === 'signer' && (f.signerIndex ?? 1) > next)));
      if (sourceTypeRef.current === 'text' && editorRef.current) {
        editorRef.current.querySelectorAll('.sign-field[data-role="signer"]').forEach((el) => {
          const si = parseInt(el.getAttribute('data-signer') || '1', 10);
          if (si > next) el.remove();
        });
        countInline();
      }
      if (placeSignerIndexRef.current > next) {
        setPlaceSignerIndex(next);
        setPlaceFor('signer');
      }
    }
    setSignerCountState(next);
    try {
      const list = await setSignerCount(cid, next);
      setSigners(list);
      persist();
    } catch (e) {
      console.error('[sign] nombre de signataires', e);
    }
  };

  const changeSigningOrder = (order: 'parallel' | 'sequential') => {
    setSigningOrder(order);
    setShowOrderMenu(false);
    const cid = contractIdRef.current;
    if (cid) updateContract(cid, { signing_order: order }).catch((e) => console.error('[sign] ordre de signature', e));
  };

  // Sélection d'un signataire (ou du propriétaire) pour la pose des champs
  const selectPlace = (target: { kind: 'owner' } | { kind: 'signer'; index: number }) => {
    if (target.kind === 'owner') {
      setPlaceFor('owner');
    } else {
      setPlaceFor('signer');
      setPlaceSignerIndex(target.index);
    }
  };

  const addField = (type: string, x: number, y: number, page: number) => {
    maybePromptVerif(type);
    const el = surfaceEl(page);
    const size = fieldDefaultSize(type);
    const maxX = el ? el.clientWidth - size.w : 9999;
    const maxY = el ? el.clientHeight - size.h : 9999;
    const f: Field = {
      id: newId(),
      type,
      x: Math.max(0, Math.min(maxX, x)),
      y: Math.max(0, Math.min(maxY, y)),
      w: size.w,
      h: size.h,
      page,
      role: placeFor,
      signerIndex: placeFor === 'signer' ? placeSignerIndexRef.current : null,
      label: type === 'checkbox' ? CHECKBOX_DEFAULT_TEXT : '',
    };
    setFields((prev) => [...prev, f]);
    persist();
  };

  // Clic panneau : texte → inline ; pdf → champ libre au centre de la page 1
  const onPanelClick = (type: string) => {
    if (sourceTypeRef.current === 'pdf') {
      const el = surfaceEl(1);
      const x = el ? el.clientWidth / 2 - 40 : 80;
      addField(type, x, 80 + (fields.length % 6) * 16, 1);
    } else {
      insertFieldInline(type);
    }
  };

  const removeField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
    persist();
  };

  const setFieldLabel = (id: string, label: string) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, label } : f)));
    persist();
  };

  // Déplacement d'un champ posé
  const moveState = useRef<{ id: string; page: number; dx: number; dy: number; sig: boolean; moved: boolean } | null>(null);
  const resizeState = useRef<{ id: string; page: number; sx: number; sy: number; sw: number; sh: number } | null>(null);

  const onFieldMouseDown = (e: React.MouseEvent, f: Field) => {
    if (validated) return;
    e.preventDefault();
    e.stopPropagation();
    const el = surfaceEl(f.page);
    if (!el) return;
    const r = el.getBoundingClientRect();
    moveState.current = { id: f.id, page: f.page, dx: e.clientX - (r.left + f.x), dy: e.clientY - (r.top + f.y), sig: isSignatureType(f.type), moved: false };
    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
  };

  const onResizeMouseDown = (e: React.MouseEvent, f: Field) => {
    if (validated) return;
    e.preventDefault();
    e.stopPropagation();
    resizeState.current = { id: f.id, page: f.page, sx: e.clientX, sy: e.clientY, sw: f.w, sh: f.h };
    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
  };

  // Déplacement / redimensionnement des images libres
  const imgMoveState = useRef<{ id: string; page: number; dx: number; dy: number } | null>(null);
  const imgResizeState = useRef<{ id: string; page: number; sx: number; sy: number; sw: number; sh: number } | null>(null);

  const onImgMouseDown = (e: React.MouseEvent, im: OverlayImage) => {
    if (validated) return;
    e.preventDefault();
    e.stopPropagation();
    const el = surfaceEl(im.page);
    if (!el) return;
    const r = el.getBoundingClientRect();
    imgMoveState.current = { id: im.id, page: im.page, dx: e.clientX - (r.left + im.x), dy: e.clientY - (r.top + im.y) };
    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
  };

  const onImgResizeMouseDown = (e: React.MouseEvent, im: OverlayImage) => {
    if (validated) return;
    e.preventDefault();
    e.stopPropagation();
    imgResizeState.current = { id: im.id, page: im.page, sx: e.clientX, sy: e.clientY, sw: im.w, sh: im.h };
    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
  };

  const onWindowMouseMove = useCallback((e: MouseEvent) => {
    // Images libres (redimensionnement proportionnel + déplacement)
    const irz = imgResizeState.current;
    if (irz) {
      const el = pdfPageRefs.current[irz.page] ?? textPageRef.current;
      const maxW = el ? el.clientWidth : 9999;
      const ar = irz.sh > 0 ? irz.sw / irz.sh : 1;
      const w = Math.max(40, Math.min(maxW, irz.sw + (e.clientX - irz.sx)));
      setImages((prev) => prev.map((im) => (im.id === irz.id ? { ...im, w, h: w / ar } : im)));
      return;
    }
    const imv = imgMoveState.current;
    if (imv) {
      const el = pdfPageRefs.current[imv.page] ?? textPageRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left - imv.dx;
      const y = e.clientY - r.top - imv.dy;
      setImages((prev) =>
        prev.map((im) =>
          im.id === imv.id
            ? { ...im, x: Math.max(0, Math.min(el.clientWidth - im.w, x)), y: Math.max(0, Math.min(el.clientHeight - im.h, y)) }
            : im,
        ),
      );
      return;
    }
    const rz = resizeState.current;
    if (rz) {
      const el = pdfPageRefs.current[rz.page] ?? textPageRef.current;
      const maxW = el ? el.clientWidth : 9999;
      const maxH = el ? el.clientHeight : 9999;
      const w = Math.max(48, Math.min(maxW, rz.sw + (e.clientX - rz.sx)));
      const h = Math.max(20, Math.min(maxH, rz.sh + (e.clientY - rz.sy)));
      setFields((prev) => prev.map((f) => (f.id === rz.id ? { ...f, w, h } : f)));
      return;
    }
    const st = moveState.current;
    if (!st) return;
    st.moved = true; // un déplacement réel a eu lieu → ce n'est pas un simple clic
    const el = pdfPageRefs.current[st.page] ?? textPageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left - st.dx;
    const y = e.clientY - r.top - st.dy;
    setFields((prev) =>
      prev.map((f) =>
        f.id === st.id
          ? { ...f, x: Math.max(0, Math.min(el.clientWidth - f.w, x)), y: Math.max(0, Math.min(el.clientHeight - f.h, y)) }
          : f,
      ),
    );
  }, []);

  const onWindowMouseUp = useCallback(() => {
    // Clic (sans déplacement) sur un champ signature → affiche la bulle ⚙️ ; sinon ferme.
    const mv = moveState.current;
    if (mv) {
      if (mv.sig && !mv.moved) setSigBubbleId(mv.id);
      else setSigBubbleId(null);
    }
    moveState.current = null;
    resizeState.current = null;
    imgMoveState.current = null;
    imgResizeState.current = null;
    window.removeEventListener('mousemove', onWindowMouseMove);
    window.removeEventListener('mouseup', onWindowMouseUp);
    persist();
  }, [onWindowMouseMove, persist]);
  useEffect(
    () => () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
    },
    [onWindowMouseMove, onWindowMouseUp],
  );

  // ---- Drag & drop panneau → surface ----
  const handleFieldDragStart = (e: React.DragEvent, type: string) => {
    e.dataTransfer.setData(DND_MIME, type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const textRangeAt = (clientX: number, clientY: number): Range | null => {
    const editor = editorRef.current;
    const range = caretRangeFromPoint(clientX, clientY);
    if (!editor || !range || !editor.contains(range.startContainer)) return null;
    const rect = range.getBoundingClientRect();
    const onText = rect.height > 0 && clientY >= rect.top - 2 && clientY <= rect.bottom + 2;
    return onText ? range : null;
  };

  const handleSurfaceDragOver = (e: React.DragEvent, page: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const el = surfaceEl(page);
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (sourceTypeRef.current === 'text') {
      const tr = textRangeAt(e.clientX, e.clientY);
      if (tr) {
        const rect = tr.getBoundingClientRect();
        setDropGhost({ page, mode: 'inline', x: rect.left - r.left, y: rect.top - r.top, h: rect.height || 18 });
        return;
      }
    }
    setDropGhost({ page, mode: 'free', x: e.clientX - r.left, y: e.clientY - r.top });
  };

  const handleSurfaceDragLeave = (e: React.DragEvent, page: number) => {
    const el = surfaceEl(page);
    if (el && !el.contains(e.relatedTarget as Node)) setDropGhost(null);
  };

  const handleSurfaceDrop = (e: React.DragEvent, page: number) => {
    e.preventDefault();
    const type = e.dataTransfer.getData(DND_MIME);
    setDropGhost(null);
    if (!type) return;

    if (sourceTypeRef.current === 'text') {
      const tr = textRangeAt(e.clientX, e.clientY);
      if (tr) {
        const chip = document.createElement('span');
        chip.className = 'sign-field';
        chip.setAttribute('data-field', type);
        chip.setAttribute('data-role', placeFor);
        if (placeFor === 'signer') chip.setAttribute('data-signer', String(placeSignerIndexRef.current));
        chip.setAttribute('contenteditable', 'false');
        chip.textContent = FIELD_LABELS[type];
        const space = document.createTextNode(' ');
        tr.insertNode(space);
        tr.insertNode(chip);
        const sel = window.getSelection();
        if (sel) {
          const a = document.createRange();
          a.setStartAfter(space);
          a.collapse(true);
          sel.removeAllRanges();
          sel.addRange(a);
          savedRange.current = a.cloneRange();
        }
        editorRef.current?.focus();
        countInline();
        persist();
        return;
      }
    }
    const el = surfaceEl(page);
    if (!el) return;
    const r = el.getBoundingClientRect();
    addField(type, e.clientX - r.left - 30, e.clientY - r.top - 11, page);
  };

  // ---- Import / retrait PDF ----
  const onImportClick = () => fileInputRef.current?.click();
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf') {
      window.alert('Veuillez sélectionner un fichier PDF.');
      return;
    }
    setImporting(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const pages = await renderPdf(dataUrl);
      setPdfPages(pages);
      setSourceType('pdf');
      sourceTypeRef.current = 'pdf';
      setFields([]);
      setInlineCount(0);
      if (!title || title === 'Contrat sans titre') setTitle(file.name.replace(/\.pdf$/i, ''));
      const cid = contractIdRef.current;
      if (cid) {
        await updateContract(cid, {
          source_type: 'pdf',
          pdf_data: dataUrl,
          content_html: null,
          page_count: pages.length,
          title: !title || title === 'Contrat sans titre' ? file.name.replace(/\.pdf$/i, '') : title,
        });
        await saveFreeFields(cid, []);
      }
    } catch (err) {
      console.error('[sign] import PDF', err);
      window.alert('Import du PDF impossible.');
    } finally {
      setImporting(false);
    }
  };

  const removePdf = async () => {
    if (!window.confirm('Retirer le PDF et revenir à un contrat texte ?')) return;
    setSourceType('text');
    sourceTypeRef.current = 'text';
    setPdfPages([]);
    setFields([]);
    setInlineCount(0);
    const cid = contractIdRef.current;
    if (cid) {
      await updateContract(cid, { source_type: 'text', pdf_data: null, content_html: DEFAULT_DOC, page_count: 1 }).catch(() => {});
      await saveFreeFields(cid, []).catch(() => {});
    }
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = DEFAULT_DOC;
        countInline();
        schedulePaginate();
      }
    }, 0);
  };

  // ---- Validation ----
  const handleValidate = () => {
    if (!hasSignatureField) return; // un champ signature est obligatoire avant validation
    setTitleDraft(title && title !== 'Contrat sans titre' ? title : '');
    setShowTitlePrompt(true); // étape 1 : donner un titre au contrat
  };
  // Titre validé → on enchaîne sur la confirmation de validation
  const continueFromTitle = () => {
    const t = titleDraft.trim();
    if (!t) return;
    setTitle(t);
    const cid = contractIdRef.current;
    if (cid) updateContract(cid, { title: t }).catch((e) => console.error('[sign] titre', e));
    setShowTitlePrompt(false);
    setShowConfirm(true);
  };
  // Duplique le contrat (tout sauf l'assignation au contact) → ouvre le nouveau brouillon
  const handleDuplicate = async () => {
    const cid = contractIdRef.current;
    if (!cid || duplicating) return;
    setDuplicating(true);
    try {
      const newId = await duplicateContract(cid);
      navigate(`/sign/app/contrat/${newId}`);
    } catch (e) {
      console.error('[sign] duplication', e);
      window.alert('Duplication impossible.');
    } finally {
      setDuplicating(false);
    }
  };
  // Ouvre la modale d'envoi : une ligne par signataire (préremplie depuis son contact)
  const openSendModal = () => {
    const rows = signersRef.current.map((s) => {
      const ct = contacts.find((c) => c.id === s.contactId);
      return { signerIndex: s.signerIndex, name: s.name || ct?.name || '', email: s.email || ct?.email || '' };
    });
    setSendRows(rows.length ? rows : [{ signerIndex: 1, name: '', email: '' }]);
    setSentLinks([]);
    setSendError('');
    setShowSend(true);
  };

  const confirmValidate = async () => {
    const cid = contractIdRef.current;
    // Fige la pagination : on bake les sauts de page (.pg-break) dans le HTML stocké
    if (editorRef.current) paginate();
    const pagedHtml = editorRef.current ? editorRef.current.innerHTML : validatedHtml;
    const cleanHtml = getCleanHtml();
    setValidatedHtml(pagedHtml);
    const inl = parseInlineFields(cleanHtml);
    setInlineFields(inl);
    if (cid) {
      try {
        const patch: any = { title, locked: true };
        if (sourceTypeRef.current === 'text') patch.content_html = pagedHtml;
        // L'édition validée n'est plus un brouillon → "En attente" (sauf si déjà envoyé/signé)
        if (status === 'draft') {
          patch.status = 'pending';
          setStatus('pending');
        }
        await updateContract(cid, patch);
        await saveFreeFields(cid, fields);
      } catch (e) {
        console.error('[sign] sauvegarde validation', e);
      }
    }
    setShowConfirm(false);
    // S'il y a des champs côté propriétaire (libres OU inline) → invite à les remplir d'abord
    if (fields.some((f) => f.role === 'owner') || inl.some((f) => f.role === 'owner')) {
      setShowOwnerPrompt(true);
    } else {
      setValidated(true);
      scrollTopView();
    }
  };

  // ---- Remplissage côté propriétaire ----
  const setFieldValue = (id: string, v: string) =>
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, value: v } : f)));

  // Valeur de profil correspondant à un type de champ (champs identité reliés)
  const profileValueFor = (type: string, p: OwnerProfile): string => {
    switch (type) {
      case 'name': return p.full_name;
      case 'email': return p.email;
      case 'tel': return p.phone;
      case 'address': return p.address;
      case 'siret': return p.siret;
      case 'siren': return p.siren;
      case 'tva': return p.tva;
      case 'company_id': return p.company_id;
      case 'ape': return p.ape;
      default: return '';
    }
  };

  // Réinitialise les champs PROPRIÉTAIRE (libres + inline) ; date/heure → aujourd'hui/maintenant
  const resetOwnerFields = () => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.role !== 'owner') return f;
        const v = f.type === 'date' ? todayLocalISO() : f.type === 'time' ? nowLocalHM() : '';
        return { ...f, value: v };
      }),
    );
    setInlineValues((prev) => {
      const next = { ...prev };
      for (const f of inlineFields) if (f.role === 'owner') next[f.fid] = '';
      return next;
    });
    setInlineResetKey((k) => k + 1); // force le remontage des inputs (vidés)
  };

  const startOwnerFill = async () => {
    setShowOwnerPrompt(false);
    // Préremplit les champs PROPRIÉTAIRE (libres + inline) depuis le profil
    try {
      const p = await getOwnerProfile();
      setFields((prev) =>
        prev.map((f) => {
          if (f.role !== 'owner' || (f.value ?? '').trim()) return f;
          const v = profileValueFor(f.type, p);
          return v ? { ...f, value: v } : f;
        }),
      );
      setInlineValues((prev) => {
        const next = { ...prev };
        for (const f of inlineFields) {
          if (f.role !== 'owner' || (next[f.fid] ?? '').trim()) continue;
          const v = profileValueFor(f.type, p);
          if (v) next[f.fid] = v;
        }
        return next;
      });
    } catch (e) {
      console.error('[sign] préremplissage profil', e);
    }
    setFillMode(true);
    scrollTopView();
  };

  const ownerComplete = () => {
    const freeOk = fields
      .filter((f) => f.role === 'owner')
      .every((f) => {
        const v = (f.value ?? '').trim();
        if (!v) return false;
        if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return false;
        return true;
      });
    const inlineOk = inlineFields
      .filter((f) => f.role === 'owner')
      .every((f) => (inlineValues[f.fid] ?? '').trim() !== '');
    return freeOk && inlineOk;
  };

  const finishOwnerFill = async () => {
    const cid = contractIdRef.current;
    setSavingFill(true);
    try {
      if (cid) {
        await saveFreeFields(cid, fields);
        await updateContract(cid, { inline_values: inlineValuesRef.current });
      }
    } catch (e) {
      console.error('[sign] sauvegarde remplissage propriétaire', e);
    } finally {
      setSavingFill(false);
    }
    setFillMode(false);
    setValidated(true);
    scrollTopView();
  };

  // ---- PDF (contrat signé) ----
  const isSigned = status === 'signed' || status === 'paid';
  const pdfOpts = () => ({
    sourceType,
    textPageEl: docRef.current,
    pdfPages,
    fields: fields.map((f) => ({ ...f, value: f.value ?? '' })),
    images,
  });

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const blob = await buildSignedPdfBlob(pdfOpts());
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(title || 'contrat').replace(/[^a-z0-9-_]+/gi, '-')}-signe.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('[sign] download pdf', e);
      window.alert('Échec de la génération du PDF.');
    } finally {
      setDownloading(false);
    }
  };

  // Certificat de preuve : ouvre le fichier scellé (source unique) ; le génère en repli si besoin.
  const handleCertificate = async () => {
    const cid = contractIdRef.current;
    if (!cid || certBusy) return;
    setCertBusy(true);
    try {
      let url = await getCertificateUrl({ contractId: cid });
      if (!url) {
        const uri = await buildSignedPdfDataUri(pdfOpts());
        const r = await generateCertificate({ contractId: cid, signedPdfDataUri: uri });
        if (r.ok) url = await getCertificateUrl({ contractId: cid });
      }
      if (url) window.open(url, '_blank');
      else window.alert('Certificat indisponible : le contrat doit être entièrement signé.');
    } catch (e) {
      console.error('[sign] certificat', e);
      window.alert('Certificat indisponible. Réessayez.');
    } finally {
      setCertBusy(false);
    }
  };

  const submitSendPdf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(pdfEmail)) {
      setPdfError('Email invalide.');
      return;
    }
    setPdfSending(true);
    setPdfError('');
    try {
      await emailSignedPdf({ ...pdfOpts(), to: pdfEmail.trim(), title });
      setPdfSent(true);
    } catch (err) {
      console.error('[sign] envoi pdf', err);
      setPdfError("L'envoi a échoué, réessayez.");
    } finally {
      setPdfSending(false);
    }
  };
  const backToEdit = () => {
    setValidated(false);
    const cid = contractIdRef.current;
    if (cid) updateContract(cid, { locked: false }).catch(() => {});
    if (sourceType === 'text') {
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.innerHTML = validatedHtml || DEFAULT_DOC;
          countInline();
          schedulePaginate();
        }
      }, 0);
    }
  };

  // ---- Envoi pour signature (multi-signataire) ----
  const submitSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const cid = contractIdRef.current;
    if (!cid || !sendRows.length) return;
    const rows = sendRows.map((r) => ({ ...r, email: r.email.trim(), name: r.name.trim() }));
    if (rows.some((r) => !isValidEmail(r.email))) {
      setSendError('Renseignez un email valide pour chaque signataire.');
      return;
    }
    setSending(true);
    setSendError('');
    try {
      const list = rows
        .map((r) => {
          const s = signersRef.current.find((x) => x.signerIndex === r.signerIndex);
          return s ? { signerId: s.id, signerIndex: r.signerIndex, name: r.name, email: r.email } : null;
        })
        .filter(Boolean) as { signerId: string; signerIndex: number; name: string; email: string }[];
      const { links } = await sendForSignatureMulti(cid, list, signingOrder);
      setSentLinks(links);
      setStatus('sent');
      const firstIdx = rows[0].signerIndex;
      setSigners((prev) =>
        prev.map((s) => {
          const r = rows.find((x) => x.signerIndex === s.signerIndex);
          if (!r) return s;
          const willSend = signingOrder === 'parallel' || r.signerIndex === firstIdx;
          return { ...s, name: r.name, email: r.email, status: willSend ? 'sent' : s.status };
        }),
      );
    } catch (err) {
      console.error('[sign] envoi signature', err);
      setSendError("L'envoi a échoué. Vérifiez les emails et réessayez.");
    } finally {
      setSending(false);
    }
  };

  const copyOne = async (link: string, idx: number) => {
    const ok = await copyTextToClipboard(link);
    if (ok) {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((c) => (c === idx ? null : c)), 1500);
    } else {
      window.prompt('Copiez le lien de signature :', link);
    }
  };

  // Popup « copier le lien » : un lien par signataire
  const openLinksPopup = async () => {
    try {
      const links = await Promise.all(
        signersRef.current.map(async (s) => ({ signerIndex: s.signerIndex, link: await getOrCreateSignLinkForSigner(s.id) })),
      );
      setHeaderLinks(links);
      setShowLinks(true);
    } catch (e) {
      console.error('[sign] liens de signature', e);
      window.alert('Impossible de générer les liens. Réessayez.');
    }
  };

  const closeSend = () => {
    setShowSend(false);
    setSendError('');
    setSentLinks([]);
  };

  contractIdRef.current = contractId;
  titleRef.current = title;
  fieldsRef.current = fields;
  sourceTypeRef.current = sourceType;
  statusRef.current = status;

  const fieldCount = fields.length + inlineCount;
  const hasSignatureField = fields.some((f) => f.type === 'signature' || f.type === 'initials') || inlineSigCount > 0;
  const docClass = theme && theme !== 'blank' ? `sign-doc theme-${theme}` : 'sign-doc';
  const BTN = 'flex h-9 w-9 items-center justify-center rounded text-[#A1A9A9] transition-colors hover:bg-[#3A4242]/40 hover:text-white active:scale-95';

  // Menus couleur / surlignage / taille (réutilisés barre + bulle)
  const renderFmtMenus = () => (
    <>
      <ToolbarMenu icon={Palette} title="Couleur du texte" btnClass={BTN}>
        {(close) => <ColorPalette onPick={(c) => { applyColor(c); close(); }} />}
      </ToolbarMenu>
      <ToolbarMenu icon={Highlighter} title="Surligner" btnClass={BTN}>
        {(close) => (
          <ColorPalette
            onPick={(c) => { applyHighlight(c); close(); }}
            extraTop={
              <button
                type="button"
                onClick={() => { applyHighlight('transparent'); close(); }}
                className="mb-2 w-full rounded border border-[#3A4242] px-2 py-1 text-[11px] text-[#A1A9A9] transition-colors hover:bg-[#191E1E] hover:text-white"
              >
                Aucun surlignage
              </button>
            }
          />
        )}
      </ToolbarMenu>
      <ToolbarMenu icon={ALargeSmall} title="Taille du texte" btnClass={BTN}>
        {(close) => (
          <div className="flex w-24 flex-col">
            {FONT_SIZES.map((s) => (
              <button key={s} type="button" onClick={() => { applyFontSize(s); close(); }} className="rounded px-2 py-1 text-left text-xs text-[#F3F4F6] transition-colors hover:bg-[#191E1E]">
                {s} px
              </button>
            ))}
          </div>
        )}
      </ToolbarMenu>
    </>
  );

  // Rendu d'un champ posé
  const renderField = (f: Field, readOnly: boolean) => {
    const meta = FIELD_META[f.type];
    if (!meta) return null;
    const { Icon, label } = meta;
    const fontSize = Math.max(9, Math.min(f.h * 0.42, 30));
    const iconSize = Math.max(10, Math.min(f.h * 0.4, 24));
    const color = fieldColor(f.role, f.signerIndex);
    const isCheckbox = f.type === 'checkbox';
    const displayLabel = f.label?.trim() ? f.label : isCheckbox ? CHECKBOX_DEFAULT_TEXT : label;
    const editing = editLabelId === f.id;
    if (isCheckbox && !editing) {
      return (
        <div
          key={f.id}
          onMouseDown={(e) => onFieldMouseDown(e, f)}
          onDoubleClick={(e) => {
            if (readOnly) return;
            e.stopPropagation();
            setEditLabelId(f.id);
          }}
          className={`sign-field-box group absolute z-20 flex select-none items-center gap-2 overflow-hidden rounded-md border border-dashed bg-[#191E1E] px-2 ${readOnly ? '' : 'cursor-move'}`}
          style={{ left: f.x, top: f.y, width: f.w, height: f.h, borderColor: color }}
          title={readOnly ? undefined : 'Double-cliquez pour modifier le texte'}
        >
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border-2" style={{ borderColor: color }} />
          <span className="truncate text-left leading-tight" style={{ fontSize: Math.max(9, Math.min(f.h * 0.32, 14)), color: '#F3F4F6' }}>
            {displayLabel}
          </span>
          {!readOnly && (
            <>
              <button
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onClick={() => removeField(f.id)}
                className="absolute right-0.5 top-0.5 hidden rounded-full bg-[#191E1E]/80 p-0.5 text-[#A1A9A9] hover:bg-[#3A4242] hover:text-white group-hover:flex"
                title="Supprimer le champ"
              >
                <X className="h-3 w-3" />
              </button>
              <span
                onMouseDown={(e) => onResizeMouseDown(e, f)}
                className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize rounded-tl-md"
                style={{ background: color }}
                title="Redimensionner"
              />
            </>
          )}
        </div>
      );
    }
    const isSig = isSignatureType(f.type);
    return (
      <Fragment key={f.id}>
      <div
        data-sigfield={f.id}
        onMouseDown={(e) => onFieldMouseDown(e, f)}
        onDoubleClick={(e) => {
          if (readOnly) return;
          e.stopPropagation();
          setEditLabelId(f.id);
        }}
        className={`sign-field-box group absolute z-20 flex select-none items-center justify-center gap-1.5 overflow-hidden rounded-md border border-dashed bg-[#191E1E] font-bold uppercase tracking-wider ${readOnly ? '' : 'cursor-move'}`}
        style={{ left: f.x, top: f.y, width: f.w, height: f.h, borderColor: color, color }}
        title={readOnly ? undefined : 'Double-cliquez pour renommer'}
      >
        <Icon style={{ width: iconSize, height: iconSize }} className="shrink-0" />
        {editing ? (
          <input
            autoFocus
            value={f.label}
            placeholder={label}
            onChange={(e) => setFieldLabel(f.id, e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            onBlur={() => {
              setEditLabelId(null);
              persist();
            }}
            className="min-w-0 flex-1 bg-transparent text-center font-bold uppercase tracking-wider outline-none"
            style={{ fontSize, color }}
          />
        ) : (
          <span className="truncate" style={{ fontSize }}>{displayLabel}</span>
        )}
        {!readOnly && (
          <>
            <button
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onClick={() => removeField(f.id)}
              className="absolute right-0.5 top-0.5 hidden rounded-full bg-[#191E1E]/80 p-0.5 text-[#A1A9A9] hover:bg-[#3A4242] hover:text-white group-hover:flex"
              title="Supprimer le champ"
            >
              <X className="h-3 w-3" />
            </button>
            <span
              onMouseDown={(e) => onResizeMouseDown(e, f)}
              className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize rounded-tl-md"
              style={{ background: color }}
              title="Redimensionner"
            />
          </>
        )}
      </div>
      {/* Bulle ⚙️ sous un champ signature sélectionné → ouvre le style de vérification */}
      {isSig && !readOnly && sigBubbleId === f.id && (
        <div
          className="sig-bubble absolute z-30"
          style={{ left: f.x, top: f.y + f.h + 6 }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSigBubbleId(null);
              setShowVerifModal(true);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-[#3A4242] bg-[#222828] px-2.5 py-1.5 text-xs font-medium text-[#A1A9A9] shadow-xl transition-colors hover:border-[#CEFF8F] hover:text-white"
            title="Style de vérification du signataire"
          >
            <Settings className="h-3.5 w-3.5" style={verificationMethod === 'email' ? { color: '#CEFF8F' } : undefined} />
            Vérification
          </button>
        </div>
      )}
      </Fragment>
    );
  };

  // Rendu d'une image libre (surcouche)
  const renderImage = (im: OverlayImage, readOnly: boolean) => (
    <div
      key={im.id}
      data-sign-field
      onMouseDown={readOnly ? undefined : (e) => onImgMouseDown(e, im)}
      onClick={readOnly ? undefined : (e) => selectFreeImage(e, im)}
      className={`group absolute z-10 ${readOnly ? '' : 'cursor-move'} ${selImg?.kind === 'free' && selImg.id === im.id ? 'outline outline-2 outline-[#CEFF8F]' : ''}`}
      style={{ left: im.x, top: im.y, width: im.w, height: im.h }}
    >
      <img src={im.src} alt="" draggable={false} className="pointer-events-none h-full w-full select-none object-contain" />
      {!readOnly && (
        <>
          <button
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onClick={() => removeImage(im.id)}
            className="absolute right-0.5 top-0.5 hidden rounded-full bg-[#191E1E]/80 p-0.5 text-[#A1A9A9] hover:bg-[#3A4242] hover:text-white group-hover:flex"
            title="Supprimer l'image"
          >
            <X className="h-3 w-3" />
          </button>
          <span
            onMouseDown={(e) => onImgResizeMouseDown(e, im)}
            className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize rounded-tl-md bg-[#CEFF8F]"
            title="Redimensionner"
          />
        </>
      )}
    </div>
  );

  const ghostFor = (page: number) =>
    dropGhost && dropGhost.page === page ? (
      dropGhost.mode === 'inline' ? (
        <div
          className="pointer-events-none absolute z-30 w-0.5 bg-[#CEFF8F]"
          style={{ left: dropGhost.x, top: dropGhost.y, height: dropGhost.h, boxShadow: '0 0 8px #CEFF8F' }}
        />
      ) : (
        <div
          className="pointer-events-none absolute z-30 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full border border-dashed border-[#CEFF8F] bg-[#CEFF8F]/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#191E1E]"
          style={{ left: dropGhost.x, top: dropGhost.y }}
        >
          <Move className="h-3 w-3" /> Déposer ici
        </div>
      )
    ) : null;

  // Rendu des pages PDF (édition ou lecture seule)
  const renderPdfPages = (readOnly: boolean) => (
    <div className="flex flex-col items-center gap-6">
      {pdfPages.map((pg, idx) => {
        const pageNum = idx + 1;
        return (
          <div
            key={idx}
            ref={(el) => {
              pdfPageRefs.current[pageNum] = el;
            }}
            className="relative bg-white shadow-2xl"
            style={{ width: pg.width, height: pg.height }}
            onDragOver={readOnly ? undefined : (e) => handleSurfaceDragOver(e, pageNum)}
            onDragLeave={readOnly ? undefined : (e) => handleSurfaceDragLeave(e, pageNum)}
            onDrop={readOnly ? undefined : (e) => handleSurfaceDrop(e, pageNum)}
          >
            <img src={pg.dataUrl} width={pg.width} height={pg.height} draggable={false} alt={`Page ${pageNum}`} />
            <span className="absolute -top-5 left-0 text-[10px] uppercase tracking-widest text-[#A1A9A9]">
              Page {pageNum}/{pdfPages.length}
            </span>
            {images.filter((im) => im.page === pageNum).map((im) => renderImage(im, readOnly))}
            {fields.filter((f) => f.page === pageNum).map((f) => renderField(f, readOnly))}
            {!readOnly && ghostFor(pageNum)}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="sign-landing flex h-screen flex-col overflow-hidden bg-[#191E1E] font-sans text-[#F3F4F6] antialiased selection:bg-[#CEFF8F] selection:text-[#191E1E]">
      <style>{`
        .sign-landing { font-family: "SF Pro Display","Helvetica Neue",Helvetica,Arial,Inter,sans-serif; }
        .sign-page { position:relative; width:210mm; min-height:297mm; padding:25mm 22mm; margin:0 auto;
          background:#fff; color:#1a1a1a; line-height:1.65; box-shadow:0 10px 50px rgba(0,0,0,.5); box-sizing:border-box; }
        .sign-doc { color:#1a1a1a; line-height:1.65; min-height:230mm; }
        .sign-doc:focus { outline:none; }
        ${PAGED_CSS}
        .sign-doc h1 { font-size:1.6rem; font-weight:700; margin:0 0 .75rem; }
        .sign-doc h2 { font-size:1.2rem; font-weight:700; margin:1.4rem 0 .5rem; }
        .sign-doc p { margin:.5rem 0; }
        .sign-doc ul { list-style:disc; padding-left:1.4rem; margin:.5rem 0; }
        .sign-doc ol { list-style:decimal; padding-left:1.4rem; margin:.5rem 0; }
        .sign-doc strong, .sign-doc b { font-weight:700; }
        .sign-doc em, .sign-doc i { font-style:italic; }
        .sign-field {
          display:inline-flex; align-items:center; gap:4px; padding:1px 9px; margin:0 1px; border-radius:9999px;
          border:1px dashed #CEFF8F; background:#191E1E; color:#CEFF8F; font-size:.72em; font-weight:700;
          letter-spacing:.04em; text-transform:uppercase; vertical-align:baseline; cursor:default; user-select:none; white-space:nowrap; }
        .sign-field::before { content:"\\2736"; font-size:.85em; opacity:.8; }
        .sign-field[data-role="owner"] { border-color:#A0E7EC; color:#A0E7EC; }
        ${signChipCss()}
        ${THEME_CSS}
      `}</style>

      <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={onFileChange} />
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={onImageFile} />

      {/* Top bar */}
      <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-y-2 border-b border-[#3A4242] bg-[#191E1E]/95 px-3 py-2.5 backdrop-blur-md sm:px-4 md:px-6 md:py-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => navigate('/sign/app/contrats')}
            className="flex items-center gap-1 rounded border border-[#3A4242] px-2.5 py-1.5 text-xs font-medium text-[#A1A9A9] transition-colors hover:border-[#A1A9A9] hover:text-white"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Retour
          </button>
          <div className="hidden items-center sm:flex">
            <SignLogo className="text-sm" />
          </div>
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => persist()}
          disabled={validated}
          className="order-3 mx-0 mt-1 w-full min-w-0 truncate rounded border border-transparent bg-transparent px-2 py-1 text-center text-sm font-medium text-white outline-none transition-colors hover:border-[#3A4242] focus:border-[#CEFF8F] disabled:cursor-not-allowed sm:order-none sm:mx-2 sm:mt-0 sm:flex-1"
        />

        <div className="flex flex-wrap items-center justify-end gap-2">
          {(status === 'sent' || status === 'signed' || status === 'paid') && (
            <button
              onClick={handleDuplicate}
              disabled={duplicating}
              title="Dupliquer ce contrat (l'assignation au contact n'est pas copiée)"
              className="flex items-center gap-1.5 rounded border border-[#3A4242] px-3 py-2 text-xs font-medium text-[#A1A9A9] transition-colors hover:border-[#A1A9A9] hover:text-white disabled:opacity-50"
            >
              {duplicating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CopyPlus className="h-3.5 w-3.5" />} Dupliquer
            </button>
          )}
          {validated ? (
            isSigned ? (
              <>
                <button
                  onClick={handleCertificate}
                  disabled={certBusy}
                  title="Certificat de preuve (document signé + faisceau de preuves)"
                  className="flex items-center gap-1.5 rounded border border-[#3A4242] px-3 py-2 text-xs font-medium text-[#A1A9A9] transition-colors hover:border-[#CEFF8F] hover:text-[#CEFF8F] disabled:opacity-50"
                >
                  {certBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  Certificat de preuve
                </button>
                <button
                  onClick={downloadPdf}
                  disabled={downloading}
                  className="flex items-center gap-1.5 rounded border border-[#3A4242] px-3 py-2 text-xs font-medium text-[#A1A9A9] transition-colors hover:border-[#CEFF8F] hover:text-[#CEFF8F] disabled:opacity-50"
                >
                  {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  Télécharger le PDF
                </button>
                <button
                  onClick={() => {
                    setShowSendPdf(true);
                    setPdfSent(false);
                    setPdfError('');
                  }}
                  className="flex items-center gap-1.5 rounded bg-[#CEFF8F] px-4 py-2 text-xs font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC]"
                >
                  <Send className="h-3.5 w-3.5" /> Envoyer le PDF par email
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={backToEdit}
                  className="flex items-center gap-1.5 rounded border border-[#3A4242] px-3 py-2 text-xs font-medium text-[#A1A9A9] transition-colors hover:border-[#A1A9A9] hover:text-white"
                >
                  <Pencil className="h-3.5 w-3.5" /> Modifier
                </button>
                <button
                  onClick={openLinksPopup}
                  className="flex items-center gap-1.5 rounded border border-[#3A4242] px-3 py-2 text-xs font-medium text-[#A1A9A9] transition-colors hover:border-[#CEFF8F] hover:text-[#CEFF8F]"
                >
                  <Copy className="h-3.5 w-3.5" /> {signerCount > 1 ? 'Copier les liens' : 'Copier le lien'}
                </button>
                <button
                  onClick={openSendModal}
                  className="flex items-center gap-1.5 rounded bg-[#CEFF8F] px-4 py-2 text-xs font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC]"
                >
                  <Send className="h-3.5 w-3.5" /> Envoyer pour signature
                </button>
              </>
            )
          ) : fillMode ? (
            <>
              <button
                onClick={resetOwnerFields}
                className="flex items-center gap-1.5 rounded border border-[#3A4242] px-3 py-2 text-xs font-medium text-[#A1A9A9] transition-colors hover:border-[#A1A9A9] hover:text-white"
                title="Effacer mes champs préremplis"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Réinitialiser
              </button>
              <button
                onClick={finishOwnerFill}
                disabled={!ownerComplete() || savingFill}
                className="flex items-center gap-1.5 rounded px-4 py-2 text-sm font-bold text-[#191E1E] transition-colors disabled:opacity-40"
                style={{ background: '#A0E7EC' }}
              >
                {savingFill ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Valider ma partie
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowVerifModal(true)}
                title="Style de vérification du signataire"
                className="flex items-center gap-1.5 rounded border border-[#3A4242] px-3 py-2 text-xs font-medium text-[#A1A9A9] transition-colors hover:border-[#A1A9A9] hover:text-white"
              >
                <ShieldCheck className="h-3.5 w-3.5" style={verificationMethod !== 'none' ? { color: '#CEFF8F' } : undefined} />
                Vérif : {verificationMethod === 'email' ? 'Email' : verificationMethod === 'sms' ? 'SMS' : verificationMethod === 'email_sms' ? 'Email+SMS' : 'Sans'}
              </button>
              <button
                onClick={() => setShowPaymentModal(true)}
                title="Paiement « Payé + signé »"
                className="flex items-center gap-1.5 rounded border border-[#3A4242] px-3 py-2 text-xs font-medium text-[#A1A9A9] transition-colors hover:border-[#A1A9A9] hover:text-white"
              >
                <CreditCard className="h-3.5 w-3.5" style={paymentEnabled ? { color: '#F0B86E' } : undefined} />
                Paiement : {paymentEnabled ? 'Activé' : 'Sans'}
              </button>
              <button
                onClick={toggleTemplate}
                title="Réutiliser ce contrat comme modèle (signatures multiples + espace closer)"
                className={`flex items-center gap-1.5 rounded border px-3 py-2 text-xs font-medium transition-colors ${isTemplate ? 'border-[#CEFF8F] text-[#CEFF8F]' : 'border-[#3A4242] text-[#A1A9A9] hover:border-[#A1A9A9] hover:text-white'}`}
              >
                <Files className="h-3.5 w-3.5" /> Modèle : {isTemplate ? 'Oui' : 'Non'}
              </button>
              {isTemplate ? (
                <button
                  onClick={() => contractId && navigate(`/sign/app/template/${contractId}`)}
                  className="flex items-center gap-1.5 rounded bg-[#CEFF8F] px-4 py-2 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC]"
                >
                  <LayoutDashboard className="h-4 w-4" /> Tableau de bord
                </button>
              ) : (
                <button
                  onClick={handleValidate}
                  disabled={!hasSignatureField}
                  title={hasSignatureField ? '' : 'Ajoutez au moins un champ Signature avant de valider'}
                  className="flex items-center gap-1.5 rounded bg-[#CEFF8F] px-4 py-2 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#CEFF8F]"
                >
                  <CheckCircle2 className="h-4 w-4" /> Valider l’édition
                </button>
              )}
            </>
          )}
        </div>
      </header>

      {/* Bannière : accès signataire bloqué (3 essais ratés) + déblocage */}
      {verificationLocked && (
        <div className="border-b border-[#ef6b6b]/30 bg-[#ef6b6b]/10 px-4 py-3 md:px-6">
          <div className="mx-auto flex max-w-4xl flex-col items-start justify-between gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-5 w-5 shrink-0 text-[#ef6b6b]" />
              <div className="text-sm">
                <div className="font-semibold text-white">Accès signataire bloqué</div>
                <div className="text-[#A1A9A9]">
                  Trop de tentatives échouées à l’étape{' '}
                  {verificationLockStep === 2 ? '2 (saisie du code)' : '1 (saisie email / numéro)'}. Le signataire ne peut plus accéder au document.
                </div>
              </div>
            </div>
            <button
              onClick={unlockVerification}
              disabled={unlocking}
              className="flex shrink-0 items-center gap-1.5 rounded bg-[#CEFF8F] px-4 py-2 text-xs font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC] disabled:opacity-50"
            >
              {unlocking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlock className="h-3.5 w-3.5" />} Débloquer l’accès
            </button>
          </div>
        </div>
      )}

      {/* Suivi des abonnements (observation) — visible une fois le contrat en circulation */}
      {paymentEnabled && (status === 'sent' || status === 'signed' || status === 'paid') && (
        <SignSubscriptionPanel contractId={contractId ?? ''} signers={signers} />
      )}

      {/* ÉTAT VALIDÉ */}
      {validated ? (
        <div ref={scrollAreaRef} className="flex-1 overflow-y-auto px-4 py-8 md:px-6">
          <div className="mx-auto max-w-4xl">
            {isSigned ? (
              <div className="mb-6 flex items-center gap-3 rounded border border-[#CEFF8F]/40 bg-[#CEFF8F]/10 px-5 py-4">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-[#CEFF8F]" />
                <div>
                  <div className="text-sm font-semibold text-white">Contrat signé ✓</div>
                  <div className="text-xs text-[#A1A9A9]">
                    Le document est finalisé et le lien de signature n’est plus actif. Téléchargez le PDF ou envoyez-le par email.
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-6 flex items-center gap-3 rounded border border-[#CEFF8F]/30 bg-[#CEFF8F]/10 px-5 py-4">
                <Lock className="h-5 w-5 shrink-0 text-[#CEFF8F]" />
                <div>
                  <div className="text-sm font-semibold text-white">Contrat validé — prêt à l’envoi</div>
                  <div className="text-xs text-[#A1A9A9]">
                    {fieldCount} champ{fieldCount > 1 ? 's' : ''} à remplir par le signataire. L’édition est verrouillée.
                  </div>
                </div>
              </div>
            )}

            {/* Suivi du lien de signature */}
            <div className="mb-6 grid gap-4 sm:grid-cols-2">
              {/* Pré-signature */}
              <div className="rounded-xl border border-[#3A4242] bg-[#222828] p-4">
                <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#A1A9A9]">
                  <Eye className="h-3.5 w-3.5 text-[#CEFF8F]" /> Avant signature
                </div>
                <div className="flex gap-8">
                  <div>
                    <div className="text-2xl font-semibold text-white">{analytics?.pre.views ?? 0}</div>
                    <div className="text-xs text-[#A1A9A9]">Vues du lien</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-2xl font-semibold text-white">
                      <Users className="h-4 w-4 text-[#A1A9A9]" />
                      {analytics?.pre.uniques ?? 0}
                    </div>
                    <div className="text-xs text-[#A1A9A9]">Personnes différentes</div>
                  </div>
                </div>
                {analytics?.pre.lastAt && (
                  <div className="mt-3 text-[11px] text-[#6b7373]">
                    Dernière vue : {new Date(analytics.pre.lastAt).toLocaleString('fr-FR')}
                  </div>
                )}
              </div>

              {/* Post-signature */}
              <div className={`rounded-xl border p-4 ${isSigned ? 'border-[#CEFF8F]/30 bg-[#CEFF8F]/5' : 'border-[#3A4242] bg-[#222828]'}`}>
                <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#A1A9A9]">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#CEFF8F]" /> Après signature
                </div>
                {isSigned ? (
                  <>
                    <div className="flex gap-8">
                      <div>
                        <div className="text-2xl font-semibold text-white">{analytics?.post.views ?? 0}</div>
                        <div className="text-xs text-[#A1A9A9]">Vues du document signé</div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 text-2xl font-semibold text-white">
                          <Download className="h-4 w-4 text-[#A1A9A9]" />
                          {analytics?.post.downloads ?? 0}
                        </div>
                        <div className="text-xs text-[#A1A9A9]">Téléchargements</div>
                      </div>
                    </div>
                    {(analytics?.signedAt || analytics?.signedBy) && (
                      <div className="mt-3 text-[11px] text-[#6b7373]">
                        Signé{analytics?.signedBy ? ` par ${analytics.signedBy}` : ''}
                        {analytics?.signedAt ? ` le ${new Date(analytics.signedAt).toLocaleString('fr-FR')}` : ''}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-2 text-sm text-[#6b7373]">En attente de signature…</div>
                )}
              </div>
            </div>

            <div className="pb-2">
              {sourceType === 'pdf' ? (
                <div className="flex flex-col items-center gap-6" ref={docRef}>
                  {pdfPages.map((pg, idx) => (
                    <FitPdfPage key={idx} width={pg.width} height={pg.height}>
                      <img src={pg.dataUrl} width={pg.width} height={pg.height} alt={`Page ${idx + 1}`} />
                      {images.filter((im) => im.page === idx + 1).map((im) => renderImage(im, true))}
                      {fields
                        .filter((f) => f.page === idx + 1)
                        .map((f) => (
                          <FillableField key={f.id} field={f} value={f.value ?? ''} onChange={() => {}} readOnly />
                        ))}
                    </FitPdfPage>
                  ))}
                </div>
              ) : (
                <SignPagedDoc html={validatedHtml} docClass={docClass} docElRef={docRef} inlineValues={inlineValues} inlineRole={null}>
                  {images.filter((im) => im.page === 1).map((im) => renderImage(im, true))}
                  {fields
                    .filter((f) => f.page === 1)
                    .map((f) => (
                      <FillableField key={f.id} field={f} value={f.value ?? ''} onChange={() => {}} readOnly />
                    ))}
                </SignPagedDoc>
              )}
            </div>
          </div>
        </div>
      ) : fillMode ? (
        /* ÉTAT REMPLISSAGE PROPRIÉTAIRE */
        <div ref={scrollAreaRef} className="flex-1 overflow-y-auto px-4 py-8 md:px-6">
          <div className="mx-auto max-w-4xl">
            <div className="mb-6 flex items-center gap-3 rounded border border-[#A0E7EC]/30 bg-[#A0E7EC]/10 px-5 py-4">
              <PenLine className="h-5 w-5 shrink-0 text-[#A0E7EC]" />
              <div>
                <div className="text-sm font-semibold text-white">Remplissez vos champs (propriétaire)</div>
                <div className="text-xs text-[#A1A9A9]">Complétez les champs en mint, puis validez votre partie.</div>
              </div>
            </div>
            <div className="pb-2">
              {sourceType === 'pdf' ? (
                <div className="flex flex-col items-center gap-6">
                  {pdfPages.map((pg, idx) => (
                    <FitPdfPage key={idx} width={pg.width} height={pg.height}>
                      <img src={pg.dataUrl} width={pg.width} height={pg.height} alt={`Page ${idx + 1}`} />
                      {images.filter((im) => im.page === idx + 1).map((im) => renderImage(im, true))}
                      {fields
                        .filter((f) => f.page === idx + 1)
                        .map((f) => (
                          <FillableField key={f.id} field={f} value={f.value ?? ''} onChange={(v) => setFieldValue(f.id, v)} readOnly={f.role !== 'owner'} />
                        ))}
                    </FitPdfPage>
                  ))}
                </div>
              ) : (
                <SignPagedDoc html={validatedHtml} docClass={docClass} inlineValues={inlineValues} inlineRole="owner" onInlineChange={setInlineValue} inlineResetKey={inlineResetKey}>
                  {images.filter((im) => im.page === 1).map((im) => renderImage(im, true))}
                  {fields
                    .filter((f) => f.page === 1)
                    .map((f) => (
                      <FillableField key={f.id} field={f} value={f.value ?? ''} onChange={(v) => setFieldValue(f.id, v)} readOnly={f.role !== 'owner'} />
                    ))}
                </SignPagedDoc>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="z-30 border-b border-[#3A4242] bg-[#222828]/95 backdrop-blur-md">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-1 px-3 py-2">
              {/* Import PDF */}
              <button
                onMouseDown={keepFocus}
                onClick={onImportClick}
                disabled={importing}
                className="flex items-center gap-1.5 rounded border border-[#3A4242] px-3 py-1.5 text-xs font-medium text-[#A1A9A9] transition-colors hover:border-[#CEFF8F] hover:text-[#CEFF8F] disabled:opacity-50"
                title="Importer un PDF"
              >
                {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
                {sourceType === 'pdf' ? 'Remplacer le PDF' : 'Importer un PDF'}
              </button>

              {sourceType === 'pdf' ? (
                <button
                  onClick={removePdf}
                  className="flex items-center gap-1.5 rounded border border-[#3A4242] px-3 py-1.5 text-xs font-medium text-[#A1A9A9] transition-colors hover:border-red-500/50 hover:text-red-400"
                  title="Retirer le PDF"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Retirer le PDF
                </button>
              ) : (
                <>
                  <div className="mx-1 h-5 w-px bg-[#3A4242]" />
                  <button onMouseDown={keepFocus} onClick={() => exec('formatBlock', '<h1>')} className={BTN} title="Titre 1"><Heading1 className="h-4 w-4" /></button>
                  <button onMouseDown={keepFocus} onClick={() => exec('formatBlock', '<h2>')} className={BTN} title="Titre 2"><Heading2 className="h-4 w-4" /></button>
                  <button onMouseDown={keepFocus} onClick={() => exec('formatBlock', '<p>')} className={BTN} title="Paragraphe"><Type className="h-4 w-4" /></button>
                  <div className="mx-1 h-5 w-px bg-[#3A4242]" />
                  <button onMouseDown={keepFocus} onClick={() => exec('bold')} className={BTN} title="Gras"><Bold className="h-4 w-4" /></button>
                  <button onMouseDown={keepFocus} onClick={() => exec('italic')} className={BTN} title="Italique"><Italic className="h-4 w-4" /></button>
                  <button onMouseDown={keepFocus} onClick={() => exec('underline')} className={BTN} title="Souligné"><Underline className="h-4 w-4" /></button>
                  <button onMouseDown={keepFocus} onClick={() => exec('strikeThrough')} className={BTN} title="Barré"><Strikethrough className="h-4 w-4" /></button>
                  <div className="mx-1 h-5 w-px bg-[#3A4242]" />
                  <button onMouseDown={keepFocus} onClick={() => exec('insertUnorderedList')} className={BTN} title="Liste à puces"><List className="h-4 w-4" /></button>
                  <button onMouseDown={keepFocus} onClick={() => exec('insertOrderedList')} className={BTN} title="Liste numérotée"><ListOrdered className="h-4 w-4" /></button>
                  <div className="mx-1 h-5 w-px bg-[#3A4242]" />
                  <button onMouseDown={keepFocus} onClick={() => exec('justifyLeft')} className={BTN} title="Aligner à gauche"><AlignLeft className="h-4 w-4" /></button>
                  <button onMouseDown={keepFocus} onClick={() => exec('justifyCenter')} className={BTN} title="Centrer"><AlignCenter className="h-4 w-4" /></button>
                  <button onMouseDown={keepFocus} onClick={() => exec('justifyRight')} className={BTN} title="Aligner à droite"><AlignRight className="h-4 w-4" /></button>
                  <div className="mx-1 h-5 w-px bg-[#3A4242]" />
                  {renderFmtMenus()}
                  <div className="mx-1 h-5 w-px bg-[#3A4242]" />
                  <button onMouseDown={keepFocus} onClick={onImageClick} className={BTN} title="Insérer une image"><ImageIcon className="h-4 w-4" /></button>
                  <button onMouseDown={keepFocus} onClick={() => exec('removeFormat')} className={BTN} title="Effacer la mise en forme"><RemoveFormatting className="h-4 w-4" /></button>
                  <button onMouseDown={keepFocus} onClick={() => exec('undo')} className={BTN} title="Annuler"><Undo2 className="h-4 w-4" /></button>
                  <button onMouseDown={keepFocus} onClick={() => exec('redo')} className={BTN} title="Rétablir"><Redo2 className="h-4 w-4" /></button>
                  <div className="mx-1 h-5 w-px bg-[#3A4242]" />
                  <button
                    onMouseDown={keepFocus}
                    onClick={addArticle}
                    className="flex items-center gap-1.5 rounded border border-[#3A4242] px-2.5 py-1.5 text-xs font-medium text-[#A1A9A9] transition-colors hover:border-[#CEFF8F] hover:text-[#CEFF8F]"
                    title="Ajouter un article (reproduit le style)"
                  >
                    <ListPlus className="h-3.5 w-3.5" /> Article
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Corps : feuille / pdf + panneau champs */}
          <div className="mx-auto flex w-full max-w-6xl flex-1 min-h-0 flex-col gap-6 overflow-y-auto px-4 md:flex-row md:overflow-visible md:px-6">
            <div className="min-w-0 flex-1 py-6 md:overflow-y-auto md:py-8">
              <div className="overflow-x-auto pb-2 pt-5">
                {sourceType === 'pdf' ? (
                  pdfPages.length > 0 ? (
                    renderPdfPages(false)
                  ) : (
                    <div className="flex h-64 items-center justify-center text-[#A1A9A9]">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Rendu du PDF…
                    </div>
                  )
                ) : (
                  <div
                    ref={textPageRef}
                    className="pg-stack"
                    style={{ minHeight: pageCount * (PG_H + PG_GAP) - PG_GAP }}
                    onDragOver={(e) => handleSurfaceDragOver(e, 1)}
                    onDragLeave={(e) => handleSurfaceDragLeave(e, 1)}
                    onDrop={(e) => handleSurfaceDrop(e, 1)}
                  >
                    {Array.from({ length: pageCount }).map((_, k) => (
                      <div key={`sheet-${k}`} className="pg-sheet" style={{ top: k * (PG_H + PG_GAP), height: PG_H }}>
                        <span className="pg-num">
                          Page {k + 1} / {pageCount}
                        </span>
                      </div>
                    ))}
                    {Array.from({ length: Math.max(0, pageCount - 1) }).map((_, k) => (
                      <div key={`div-${k}`} className="pg-divider" style={{ top: (k + 1) * (PG_H + PG_GAP) - 14 }} />
                    ))}
                    <div
                      ref={editorRef}
                      contentEditable
                      suppressContentEditableWarning
                      onInput={() => {
                        countInline();
                        persist();
                        schedulePaginate();
                      }}
                      onClick={onEditorClick}
                      onMouseUp={() => {
                        saveSelection();
                        persist();
                        updateFmtBar();
                      }}
                      onKeyUp={() => {
                        saveSelection();
                        countInline();
                        updateFmtBar();
                      }}
                      onBlur={saveSelection}
                      className={`${docClass} pg-doc`}
                      style={{ minHeight: pageCount * (PG_H + PG_GAP) - PG_GAP }}
                    />
                    {images.filter((im) => im.page === 1).map((im) => renderImage(im, false))}
                    {fields.filter((f) => f.page === 1).map((f) => renderField(f, false))}
                    {ghostFor(1)}
                  </div>
                )}
              </div>
              <p className="mt-3 text-center text-xs text-[#A1A9A9]">
                {sourceType === 'pdf' ? 'PDF importé' : 'Format A4'} · {loading ? 'Chargement…' : 'Enregistré sur le cloud'} ·{' '}
                {fieldCount} champ{fieldCount > 1 ? 's' : ''} signataire
                {sourceType === 'pdf' && ' · champs en glisser-déposer uniquement'}
              </p>
            </div>

            {/* Panneau champs */}
            <aside className="pb-8 md:w-72 md:shrink-0 md:overflow-y-auto md:py-8">
              <div className="rounded border border-[#3A4242] bg-[#222828] p-4 sm:p-5">
                {/* Nombre de signataires + ordre de signature */}
                <div className="mb-4">
                  <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">Signataires</h3>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-1 items-center justify-between rounded-lg border border-[#3A4242] bg-[#191E1E] px-2 py-1.5">
                      <button
                        onClick={() => changeSignerCount(signerCount - 1)}
                        disabled={signerCount <= 1 || validated}
                        className="flex h-6 w-6 items-center justify-center rounded text-[#A1A9A9] transition-colors hover:bg-[#3A4242] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                        title="Retirer un signataire"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-sm font-semibold text-white">{signerCount}</span>
                      <button
                        onClick={() => changeSignerCount(signerCount + 1)}
                        disabled={signerCount >= MAX_SIGNERS || validated}
                        className="flex h-6 w-6 items-center justify-center rounded text-[#A1A9A9] transition-colors hover:bg-[#3A4242] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                        title="Ajouter un signataire"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => setShowOrderMenu((v) => !v)}
                        disabled={validated}
                        title="Ordre de signature"
                        className="flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-[#3A4242] bg-[#191E1E] text-[#A1A9A9] transition-colors hover:border-[#A1A9A9] hover:text-white disabled:opacity-40"
                      >
                        <Settings className="h-4 w-4" style={signingOrder === 'sequential' ? { color: '#CEFF8F' } : undefined} />
                      </button>
                      {showOrderMenu && (
                        <>
                          <button className="fixed inset-0 z-40 cursor-default" onClick={() => setShowOrderMenu(false)} tabIndex={-1} aria-label="Fermer" />
                          <div ref={orderMenuRef} className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-[#3A4242] bg-[#222828] p-2 shadow-2xl">
                            {([
                              { key: 'parallel', title: 'Quand ils veulent', desc: 'Tout le monde peut signer en même temps.' },
                              { key: 'sequential', title: 'À la suite', desc: 'Signataire 1, puis 2, puis 3…' },
                            ] as const).map((o) => (
                              <button
                                key={o.key}
                                onClick={() => changeSigningOrder(o.key)}
                                className={`flex w-full items-start gap-2 rounded-lg p-2.5 text-left transition-colors ${signingOrder === o.key ? 'bg-[#CEFF8F]/10' : 'hover:bg-[#191E1E]'}`}
                              >
                                <span className="min-w-0 flex-1">
                                  <span className="block text-xs font-semibold text-[#F3F4F6]">{o.title}</span>
                                  <span className="mt-0.5 block text-[11px] leading-snug text-[#A1A9A9]">{o.desc}</span>
                                </span>
                                {signingOrder === o.key && <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#CEFF8F]" />}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sélecteur : pour qui place-t-on les champs (Signataire 1..N / Propriétaire) */}
                <div className="mb-4">
                  <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">Champs pour…</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: signerCount }, (_, i) => i + 1).map((idx) => {
                      const active = placeFor === 'signer' && placeSignerIndex === idx;
                      const c = signerColor(idx);
                      return (
                        <button
                          key={idx}
                          onClick={() => selectPlace({ kind: 'signer', index: idx })}
                          className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors"
                          style={active ? { background: c, borderColor: c, color: '#191E1E' } : { borderColor: '#3A4242', color: '#A1A9A9' }}
                        >
                          <span className="h-2 w-2 rounded-full" style={{ background: active ? '#191E1E' : c }} />
                          {signerCount > 1 ? `Signataire ${idx}` : 'Signataire'}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => selectPlace({ kind: 'owner' })}
                      className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors"
                      style={placeFor === 'owner' ? { background: '#A0E7EC', borderColor: '#A0E7EC', color: '#191E1E' } : { borderColor: '#3A4242', color: '#A1A9A9' }}
                    >
                      Propriétaire
                    </button>
                  </div>
                </div>

                {/* Préremplir depuis un contact (signataire sélectionné) */}
                {placeFor === 'signer' && (
                  <div className="mb-5">
                    <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">
                      Préremplir {signerCount > 1 ? `le signataire ${placeSignerIndex}` : 'depuis un contact'}
                    </h3>
                    <ContactPicker contacts={contacts} groups={groups} onSelect={prefillFromContact} />
                    <p className="mt-2 text-[11px] leading-relaxed text-[#A1A9A9]">
                      Seuls les champs Email, Téléphone et Adresse de ce signataire sont préremplis.
                    </p>
                  </div>
                )}

                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">
                  {placeFor === 'owner' ? 'Champs du propriétaire (vous)' : signerCount > 1 ? `Champs du signataire ${placeSignerIndex}` : 'Champs du signataire'}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-[#A1A9A9]">
                  {placeFor === 'owner' ? (
                    <>
                      <span className="text-[#F3F4F6]">Glissez-déposez</span> les champs que <span className="text-[#F3F4F6]">vous</span> (propriétaire) devrez remplir ou signer.
                    </>
                  ) : sourceType === 'pdf' ? (
                    <>
                      <span className="text-[#F3F4F6]">Glissez-déposez</span> un champ n’importe où sur le PDF. Le signataire le complétera.
                    </>
                  ) : (
                    <>
                      <span className="text-[#F3F4F6]">Cliquez</span> pour insérer dans le texte au curseur. <span className="text-[#F3F4F6]">Glissez-déposez</span> pour poser librement, même dans le blanc.
                    </>
                  )}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {FIELD_TYPES.map((f) => (
                    <button
                      key={f.type}
                      draggable
                      onDragStart={(e) => handleFieldDragStart(e, f.type)}
                      onClick={() => onPanelClick(f.type)}
                      className="group flex cursor-grab flex-col items-start gap-2 rounded border border-[#3A4242] bg-[#191E1E] p-3 text-left transition-colors hover:border-[#CEFF8F] hover:bg-[#CEFF8F]/5 active:cursor-grabbing"
                    >
                      <div className="flex w-full items-center justify-between">
                        <f.icon className="h-4 w-4" style={{ color: fieldColor(placeFor, placeSignerIndex) }} />
                        <GripVertical className="h-3.5 w-3.5 text-[#3A4242] transition-colors group-hover:text-[#A1A9A9]" />
                      </div>
                      <span className="text-xs font-medium leading-tight text-white">{f.label}</span>
                    </button>
                  ))}
                </div>

                <div className="mt-5 flex items-center justify-between rounded border border-[#3A4242] bg-[#191E1E] px-3 py-2.5">
                  <span className="text-xs text-[#A1A9A9]">Champs posés</span>
                  <span className="rounded-full bg-[#CEFF8F] px-2 py-0.5 text-xs font-bold text-[#191E1E]">{fieldCount}</span>
                </div>

                {!hasSignatureField && (
                  <div className="mt-3 flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-400">
                    <Signature className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Ajoutez au moins un champ <span className="font-semibold">Signature</span> pour pouvoir valider l’édition.
                    </span>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </>
      )}

      {/* Pop-up « Style de vérification » du signataire */}
      <VerificationStyleModal
        open={showVerifModal}
        method={verificationMethod}
        signers={signers.map((s) => ({
          index: s.signerIndex,
          label: signerCount > 1 ? `Signataire ${s.signerIndex}` : 'Signataire',
          emails: s.verificationEmails,
          phones: s.verificationPhones,
          pairs: s.verificationPairs,
        }))}
        onClose={() => setShowVerifModal(false)}
        onConfirm={onVerifConfirm}
      />
      <PaymentConfigModal
        open={showPaymentModal}
        enabled={paymentEnabled}
        paymentInit={paymentDraft}
        payerScope={payerScope}
        signers={signers.map((s) => ({ index: s.signerIndex, label: `Signataire ${s.signerIndex}` }))}
        stripeConnected={stripeConnected}
        onConnectStripe={onConnectStripe}
        onClose={() => setShowPaymentModal(false)}
        onConfirm={onPaymentConfirm}
      />

      {/* Étape 1 : donner un titre au contrat */}
      {showTitlePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded border border-[#3A4242] bg-[#222828] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Titre du contrat</h3>
              <button onClick={() => setShowTitlePrompt(false)} className="text-[#A1A9A9] transition-colors hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm leading-relaxed text-[#A1A9A9]">
              Donnez un titre clair à ce contrat (visible dans vos contrats et par le signataire).
            </p>
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') continueFromTitle();
              }}
              placeholder="Ex. Contrat de prestation — Société X"
              className="w-full rounded border border-[#3A4242] bg-[#191E1E] px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-[#A1A9A9]/40 focus:border-[#CEFF8F]"
            />
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowTitlePrompt(false)}
                className="rounded border border-[#3A4242] px-4 py-2 text-sm font-medium text-[#A1A9A9] transition-colors hover:border-[#A1A9A9] hover:text-white"
              >
                Annuler
              </button>
              <button
                onClick={continueFromTitle}
                disabled={!titleDraft.trim()}
                className="flex items-center gap-1.5 rounded bg-[#CEFF8F] px-4 py-2 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" /> Continuer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmation */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded border border-[#3A4242] bg-[#222828] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Valider l’édition du contrat</h3>
              <button onClick={() => setShowConfirm(false)} className="text-[#A1A9A9] transition-colors hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-5 flex items-center gap-3 rounded border border-[#3A4242] bg-[#191E1E] px-4 py-3">
              <FileText className="h-5 w-5 shrink-0 text-[#CEFF8F]" />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-white">{title}</div>
                <div className="text-xs text-[#A1A9A9]">
                  {fieldCount} champ{fieldCount > 1 ? 's' : ''} à remplir par le signataire
                </div>
              </div>
            </div>

            {fieldCount === 0 && (
              <p className="mb-5 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                Aucun champ signataire n’a été posé. Le signataire ne pourra rien compléter. Continuer quand même ?
              </p>
            )}

            <p className="mb-6 text-sm leading-relaxed text-[#A1A9A9]">
              Une fois validée, l’édition est verrouillée. Le contrat sera prêt à être envoyé pour signature. Vous pourrez
              toujours revenir le modifier.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded border border-[#3A4242] px-4 py-2 text-sm font-medium text-[#A1A9A9] transition-colors hover:border-[#A1A9A9] hover:text-white"
              >
                Annuler
              </button>
              <button
                onClick={confirmValidate}
                className="flex items-center gap-1.5 rounded bg-[#CEFF8F] px-4 py-2 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC]"
              >
                <CheckCircle2 className="h-4 w-4" /> Valider
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up : champs à remplir côté propriétaire */}
      {showOwnerPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded border border-[#3A4242] bg-[#222828] p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#A0E7EC]/15">
                <PenLine className="h-5 w-5 text-[#A0E7EC]" />
              </div>
              <h3 className="text-lg font-semibold text-white">Vos champs à remplir</h3>
            </div>
            <p className="mb-6 text-sm leading-relaxed text-[#A1A9A9]">
              Vous avez{' '}
              <span className="font-semibold text-white">
                {fields.filter((f) => f.role === 'owner').length} champ
                {fields.filter((f) => f.role === 'owner').length > 1 ? 's' : ''}
              </span>{' '}
              à remplir ou signer de votre côté (propriétaire) avant d’envoyer le contrat.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowOwnerPrompt(false);
                  setValidated(true);
                }}
                className="rounded border border-[#3A4242] px-4 py-2 text-sm font-medium text-[#A1A9A9] transition-colors hover:border-[#A1A9A9] hover:text-white"
              >
                Plus tard
              </button>
              <button
                onClick={startOwnerFill}
                className="flex items-center gap-1.5 rounded px-4 py-2 text-sm font-bold text-[#191E1E]"
                style={{ background: '#A0E7EC' }}
              >
                <PenLine className="h-4 w-4" /> Remplir mes champs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal : envoyer le PDF signé par email */}
      {showSendPdf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-[#3A4242] bg-[#222828] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Envoyer le PDF par email</h3>
              <button onClick={() => setShowSendPdf(false)} className="text-[#A1A9A9] transition-colors hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            {pdfSent ? (
              <div>
                <div className="mb-5 flex items-center gap-3 rounded border border-[#CEFF8F]/30 bg-[#CEFF8F]/10 px-4 py-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[#CEFF8F]" />
                  <div className="text-sm text-white">PDF envoyé à <span className="font-semibold">{pdfEmail}</span>.</div>
                </div>
                <button
                  onClick={() => setShowSendPdf(false)}
                  className="w-full rounded border border-[#3A4242] py-2.5 text-sm font-medium text-[#A1A9A9] transition-colors hover:border-[#A1A9A9] hover:text-white"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <form onSubmit={submitSendPdf} className="space-y-4">
                <p className="text-sm leading-relaxed text-[#A1A9A9]">Indiquez l’adresse qui recevra la copie PDF du contrat signé.</p>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
                  <input
                    type="email"
                    required
                    value={pdfEmail}
                    onChange={(e) => setPdfEmail(e.target.value)}
                    placeholder="destinataire@exemple.fr"
                    className="w-full rounded border border-[#3A4242] bg-[#191E1E] py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-[#A1A9A9]/40 focus:border-[#CEFF8F]"
                  />
                </div>
                {pdfError && <p className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">{pdfError}</p>}
                <button
                  type="submit"
                  disabled={pdfSending}
                  className="flex w-full items-center justify-center gap-2 rounded bg-[#CEFF8F] py-2.5 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC] disabled:opacity-60"
                >
                  {pdfSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {pdfSending ? 'Envoi…' : 'Envoyer le PDF'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal envoi pour signature (multi-signataire) */}
      {showSend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded border border-[#3A4242] bg-[#222828] p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Envoyer pour signature</h3>
              <button onClick={closeSend} className="text-[#A1A9A9] transition-colors hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {sentLinks.length ? (
              <div>
                <div className="mb-5 flex items-center gap-3 rounded border border-[#CEFF8F]/30 bg-[#CEFF8F]/10 px-4 py-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[#CEFF8F]" />
                  <div className="text-sm text-white">
                    {signingOrder === 'sequential'
                      ? 'Envoyé au 1er signataire. Les suivants seront notifiés automatiquement.'
                      : `Envoyé à ${sentLinks.length} signataire${sentLinks.length > 1 ? 's' : ''}.`}
                  </div>
                </div>
                <div className="space-y-2">
                  {sentLinks.map((l) => (
                    <div key={l.signerIndex} className="rounded border border-[#3A4242] bg-[#191E1E] p-3">
                      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold" style={{ color: signerColor(l.signerIndex) }}>
                        <span className="h-2 w-2 rounded-full" style={{ background: signerColor(l.signerIndex) }} />
                        {signerCount > 1 ? `Signataire ${l.signerIndex}` : 'Signataire'}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-2 rounded border border-[#3A4242] bg-[#222828] px-2.5 py-2">
                          <LinkIcon className="h-3.5 w-3.5 shrink-0 text-[#A1A9A9]" />
                          <span className="truncate text-[11px] text-[#F3F4F6]">{l.link}</span>
                        </div>
                        <button onClick={() => copyOne(l.link, l.signerIndex)} className="flex shrink-0 items-center gap-1 rounded bg-[#CEFF8F] px-2.5 py-2 text-[11px] font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC]">
                          {copiedIdx === l.signerIndex ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          {copiedIdx === l.signerIndex ? 'Copié' : 'Copier'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={closeSend} className="mt-6 w-full rounded border border-[#3A4242] py-2.5 text-sm font-medium text-[#A1A9A9] transition-colors hover:border-[#A1A9A9] hover:text-white">
                  Fermer
                </button>
              </div>
            ) : (
              <form onSubmit={submitSend} className="space-y-4">
                <p className="text-sm leading-relaxed text-[#A1A9A9]">
                  {signingOrder === 'sequential'
                    ? 'Signature à la suite : seul le 1er signataire reçoit son lien maintenant. Les suivants sont notifiés dès que le précédent a signé.'
                    : 'Chaque signataire reçoit son propre lien sécurisé pour signer.'}
                </p>
                {sendRows.map((row, i) => (
                  <div key={row.signerIndex} className="rounded-lg border border-[#3A4242] bg-[#191E1E] p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold" style={{ color: signerColor(row.signerIndex) }}>
                      <span className="h-2 w-2 rounded-full" style={{ background: signerColor(row.signerIndex) }} />
                      {sendRows.length > 1 ? `Signataire ${row.signerIndex}` : 'Signataire'}
                    </div>
                    {contacts.length > 0 && (
                      <div className="mb-2">
                        <ContactPicker
                          contacts={contacts}
                          groups={groups}
                          onSelect={(c) => setSendRows((prev) => prev.map((r, k) => (k === i ? { ...r, name: c.name, email: c.email } : r)))}
                        />
                      </div>
                    )}
                    <div className="relative mb-2">
                      <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
                      <input
                        value={row.name}
                        onChange={(e) => setSendRows((prev) => prev.map((r, k) => (k === i ? { ...r, name: e.target.value } : r)))}
                        placeholder="Nom du signataire"
                        className="w-full rounded border border-[#3A4242] bg-[#222828] py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-[#A1A9A9]/40 focus:border-[#CEFF8F]"
                      />
                    </div>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
                      <input
                        type="email"
                        required
                        value={row.email}
                        onChange={(e) => setSendRows((prev) => prev.map((r, k) => (k === i ? { ...r, email: e.target.value } : r)))}
                        placeholder="email@exemple.fr"
                        className="w-full rounded border border-[#3A4242] bg-[#222828] py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-[#A1A9A9]/40 focus:border-[#CEFF8F]"
                      />
                    </div>
                  </div>
                ))}

                {sendError && <p className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">{sendError}</p>}

                <div className="flex justify-end gap-3 pt-1">
                  <button type="button" onClick={closeSend} className="rounded border border-[#3A4242] px-4 py-2 text-sm font-medium text-[#A1A9A9] transition-colors hover:border-[#A1A9A9] hover:text-white">
                    Annuler
                  </button>
                  <button type="submit" disabled={sending} className="flex items-center gap-1.5 rounded bg-[#CEFF8F] px-4 py-2 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC] disabled:opacity-60">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {sending ? 'Envoi…' : 'Envoyer'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Popup « copier le lien » : un lien par signataire */}
      {showLinks && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" onMouseDown={() => setShowLinks(false)}>
          <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded border border-[#3A4242] bg-[#222828] p-6 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">{headerLinks.length > 1 ? 'Liens de signature' : 'Lien de signature'}</h3>
              <button onClick={() => setShowLinks(false)} className="text-[#A1A9A9] transition-colors hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-2">
              {headerLinks.map((l) => (
                <div key={l.signerIndex} className="rounded border border-[#3A4242] bg-[#191E1E] p-3">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold" style={{ color: signerColor(l.signerIndex) }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: signerColor(l.signerIndex) }} />
                    {headerLinks.length > 1 ? `Signataire ${l.signerIndex}` : 'Signataire'}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-2 rounded border border-[#3A4242] bg-[#222828] px-2.5 py-2">
                      <LinkIcon className="h-3.5 w-3.5 shrink-0 text-[#A1A9A9]" />
                      <span className="truncate text-[11px] text-[#F3F4F6]">{l.link}</span>
                    </div>
                    <button onClick={() => copyOne(l.link, l.signerIndex)} className="flex shrink-0 items-center gap-1 rounded bg-[#CEFF8F] px-2.5 py-2 text-[11px] font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC]">
                      {copiedIdx === l.signerIndex ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedIdx === l.signerIndex ? 'Copié' : 'Copier'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bulle de sélection du mode d'une image */}
      {/* Bulle d'un champ inline : changer le rôle / supprimer */}
      {chipMenu && !validated && (
        <div
          ref={chipMenuRef}
          style={{ position: 'fixed', left: chipMenu.x, top: chipMenu.y + 8, zIndex: 60 }}
          className="flex items-center gap-1 rounded-lg border border-[#3A4242] bg-[#222828] p-1 shadow-2xl"
        >
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setChipRole('owner')}
            className={`rounded px-2.5 py-1.5 text-xs font-semibold transition-colors ${chipMenu.role === 'owner' ? 'bg-[#A0E7EC] text-[#191E1E]' : 'text-[#A1A9A9] hover:text-white'}`}
          >
            Propriétaire
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setChipRole('signer')}
            className={`rounded px-2.5 py-1.5 text-xs font-semibold transition-colors ${chipMenu.role === 'signer' ? 'bg-[#CEFF8F] text-[#191E1E]' : 'text-[#A1A9A9] hover:text-white'}`}
          >
            Signataire
          </button>
          <div className="mx-0.5 h-5 w-px bg-[#3A4242]" />
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={deleteChip}
            title="Supprimer le champ"
            className="rounded p-1.5 text-[#A1A9A9] transition-colors hover:bg-red-500/15 hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {selImg && bubblePos && !validated && (
        <div
          ref={bubbleRef}
          style={{ position: 'fixed', left: bubblePos.x, top: bubblePos.y + 8, zIndex: 60 }}
          className="flex items-center gap-1 rounded-lg border border-[#3A4242] bg-[#222828] p-1 shadow-2xl"
        >
          <button
            onClick={freeToInline}
            className={`rounded px-2.5 py-1.5 text-xs font-semibold transition-colors ${selImg.kind === 'inline' ? 'bg-[#CEFF8F] text-[#191E1E]' : 'text-[#A1A9A9] hover:text-white'}`}
          >
            À la suite
          </button>
          <button
            onClick={inlineToFree}
            className={`rounded px-2.5 py-1.5 text-xs font-semibold transition-colors ${selImg.kind === 'free' ? 'bg-[#CEFF8F] text-[#191E1E]' : 'text-[#A1A9A9] hover:text-white'}`}
          >
            Libre
          </button>
          <span className="mx-0.5 h-4 w-px bg-[#3A4242]" />
          <button onClick={deleteSelectedImage} className="rounded p-1.5 text-[#A1A9A9] transition-colors hover:bg-[#3A4242] hover:text-white" title="Supprimer">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Barre de mise en forme flottante (sélection de texte) */}
      {fmtBar && !validated && !fillMode && sourceType === 'text' && (
        <div
          ref={fmtBubbleRef}
          style={{ position: 'fixed', left: fmtBar.x, top: fmtBar.y - 10, transform: 'translate(-50%, -100%)', zIndex: 60 }}
          className="flex items-center gap-0.5 rounded-lg border border-[#3A4242] bg-[#222828] p-1 shadow-2xl"
        >
          <button onMouseDown={keepFocus} onClick={() => exec('bold')} className={BTN} title="Gras"><Bold className="h-4 w-4" /></button>
          <button onMouseDown={keepFocus} onClick={() => exec('italic')} className={BTN} title="Italique"><Italic className="h-4 w-4" /></button>
          <button onMouseDown={keepFocus} onClick={() => exec('underline')} className={BTN} title="Souligné"><Underline className="h-4 w-4" /></button>
          <button onMouseDown={keepFocus} onClick={() => exec('strikeThrough')} className={BTN} title="Barré"><Strikethrough className="h-4 w-4" /></button>
          <span className="mx-0.5 h-4 w-px bg-[#3A4242]" />
          <button onMouseDown={keepFocus} onClick={() => exec('formatBlock', '<h1>')} className={BTN} title="Titre 1"><Heading1 className="h-4 w-4" /></button>
          <button onMouseDown={keepFocus} onClick={() => exec('formatBlock', '<h2>')} className={BTN} title="Titre 2"><Heading2 className="h-4 w-4" /></button>
          <button onMouseDown={keepFocus} onClick={() => exec('formatBlock', '<p>')} className={BTN} title="Paragraphe"><Type className="h-4 w-4" /></button>
          <span className="mx-0.5 h-4 w-px bg-[#3A4242]" />
          <button onMouseDown={keepFocus} onClick={() => exec('insertUnorderedList')} className={BTN} title="Liste à puces"><List className="h-4 w-4" /></button>
          <button onMouseDown={keepFocus} onClick={() => exec('insertOrderedList')} className={BTN} title="Liste numérotée"><ListOrdered className="h-4 w-4" /></button>
          <span className="mx-0.5 h-4 w-px bg-[#3A4242]" />
          {renderFmtMenus()}
        </div>
      )}
    </div>
  );
}
