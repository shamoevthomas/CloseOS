import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ShieldCheck, Loader2, PenLine, CheckCircle2, Download, X, Mail, User, RotateCcw, Lock, Clock } from 'lucide-react';
import { getContractByToken, saveSignerFields, saveSignerContact, setSignerInlineValues, logOpened, logDownloaded } from '../lib/signContracts';
import { parseInlineFields } from '../lib/signInline';
import { isValidEmail, todayLocalISO, nowLocalHM } from '../lib/signFieldsMeta';
import { THEME_CSS } from '../lib/signThemes';
import { PAGED_CSS } from '../lib/signPaging';
import SignPagedDoc from '../components/SignPagedDoc';
import { emailSignedPdf, buildSignedPdfDataUri } from '../lib/signPdfExport';
import { generateCertificate, getCertificateUrl } from '../lib/signCertificate';
import { signSupabase as supabase } from '../lib/signSupabase';
import FillableField from '../components/FillableField';
import PhoneInput from '../components/PhoneInput';
import SignVerificationModal from '../components/SignVerificationModal';
import SignPaymentModal from '../components/SignPaymentModal';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const TARGET_W = 794;

// Identifiant visiteur persistant (par navigateur) → compter les personnes différentes
function getVisitorId(): string {
  try {
    let v = localStorage.getItem('sign_visitor');
    if (!v) {
      v = `v_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      localStorage.setItem('sign_visitor', v);
    }
    return v;
  } catch {
    return 'anon';
  }
}

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

const Logo = ({ className = '' }: { className?: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" />
    <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function SignPublic() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<Awaited<ReturnType<typeof getContractByToken>> | null>(null);
  const [pdfPages, setPdfPages] = useState<PdfPage[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [inlineValues, setInlineValues] = useState<Record<string, string>>({});
  const [inlineResetKey, setInlineResetKey] = useState(0);
  const [signed, setSigned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const docRef = useRef<HTMLDivElement>(null);
  // Vérification d'identité (email) avant signature
  const [verified, setVerified] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState(''); // email validé → préremplit la copie PDF
  const [verifiedPhone, setVerifiedPhone] = useState(''); // numéro validé (SMS) → préremplit le tél.
  const [verifOpen, setVerifOpen] = useState(false);
  const verifResolver = useRef<((ok: boolean) => void) | null>(null);
  // Paiement (« Payé + signé »)
  const [payOpen, setPayOpen] = useState(false);
  const [payInfo, setPayInfo] = useState<{ clientSecret: string; type: 'payment' | 'setup'; amount: number; currency: string } | null>(null);
  // Blocage anti-brute-force (3 essais ratés) → page verrouillée
  const [locked, setLocked] = useState(false);
  const [lockInfo, setLockInfo] = useState<{ reason?: string; step?: number }>({});
  const [showDownload, setShowDownload] = useState(false);
  const [dlName, setDlName] = useState('');
  const [dlEmail, setDlEmail] = useState('');
  const [dlPhone, setDlPhone] = useState('');
  const [dlSending, setDlSending] = useState(false);
  const [dlSent, setDlSent] = useState(false);
  const [dlError, setDlError] = useState('');
  // Consentement explicite (obligatoire, tous modes) + génération du certificat de preuve
  const [consented, setConsented] = useState(false);
  const [certifying, setCertifying] = useState(false);
  const [certError, setCertError] = useState('');

  useEffect(() => {
    document.title = 'Signer le document | CloseOS Sign';
    let cancelled = false;
    (async () => {
      try {
        if (!token) return;
        const data = await getContractByToken(token);
        if (cancelled) return;
        setContract(data);
        if (data) {
          const mineSigned = data.signerStatus === 'signed' || data.status === 'signed' || data.status === 'paid';
          const baseValues: Record<string, string> = Object.fromEntries(data.fields.map((f) => [f.id, f.value ?? '']));
          const baseInline: Record<string, string> = { ...(data.inline_values || {}) };
          // Préremplit les champs VIDES du signataire depuis le contact rattaché (libres + inline)
          const c = data.contact;
          if (c && !mineSigned) {
            const contactVal = (type: string): string => {
              switch (type) {
                case 'name': return c.name || '';
                case 'email': return c.email || '';
                case 'tel': return c.phone || '';
                case 'address': return c.address || '';
                case 'siret': return c.siret || '';
                case 'siren': return c.siren || '';
                case 'tva': return c.tva || '';
                case 'company_id': return c.company_id || '';
                case 'ape': return c.ape || '';
                default: return '';
              }
            };
            for (const f of data.fields) {
              if (f.role === 'signer' && !(baseValues[f.id] ?? '').trim()) {
                const v = contactVal(f.type);
                if (v) baseValues[f.id] = v;
              }
            }
            for (const inl of parseInlineFields(data.content_html)) {
              if (inl.role === 'signer' && !(baseInline[inl.fid] ?? '').trim()) {
                const v = contactVal(inl.type);
                if (v) baseInline[inl.fid] = v;
              }
            }
          }
          setValues(baseValues);
          setInlineValues(baseInline);
          if (mineSigned) setSigned(true);
          if (data.verification_locked) {
            setLocked(true);
            setLockInfo({ reason: data.verification_lock_reason ?? undefined, step: data.verification_lock_step ?? undefined });
          }
          if (token) logOpened(token, getVisitorId());
          if (data.source_type === 'pdf' && data.pdf_data) {
            try {
              setPdfPages(await renderPdf(data.pdf_data));
            } catch (e) {
              console.error('[sign] rendu PDF public', e);
            }
          }
        }
      } catch (e) {
        console.error('[sign] chargement public', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const mySignerIndex = contract?.signerIndex ?? 1;
  const signerFields = useMemo(
    () => (contract?.fields ?? []).filter((f) => f.role === 'signer' && (f.signerIndex ?? 1) === mySignerIndex),
    [contract, mySignerIndex],
  );
  const signerInline = useMemo(
    () => parseInlineFields(contract?.content_html ?? '').filter((f) => f.role === 'signer' && f.signerIndex === mySignerIndex),
    [contract, mySignerIndex],
  );
  // Tour de signature (mode séquentiel) : tous les signataires d'index inférieur doivent avoir signé
  const myTurn = useMemo(() => {
    if (!contract || contract.signing_order !== 'sequential') return true;
    return (contract.signers ?? []).filter((s) => s.signerIndex < mySignerIndex).every((s) => s.status === 'signed');
  }, [contract, mySignerIndex]);
  // Suis-je le dernier à signer ? (heuristique d'instantané au chargement → email PDF au proprio)
  const othersAllSigned = useMemo(
    () => (contract?.signers ?? []).filter((s) => s.signerIndex !== mySignerIndex).every((s) => s.status === 'signed'),
    [contract, mySignerIndex],
  );

  // Identité saisie par le signataire dans le contrat (champ libre OU inline) → préremplir la modale PDF
  const signerIdentity = useMemo(() => {
    const byType = (t: string) => {
      const f = signerFields.find((x) => x.type === t);
      const free = f ? (values[f.id] ?? '').trim() : '';
      if (free) return free;
      const inl = signerInline.find((x) => x.type === t);
      return inl ? (inlineValues[inl.fid] ?? '').trim() : '';
    };
    return { name: byType('name'), email: byType('email'), phone: byType('tel') };
  }, [signerFields, signerInline, values, inlineValues]);

  // Ouvre la modale "Recevoir une copie PDF" en la préremplissant avec ce que le signataire a écrit.
  // (Tous les setState étant batchés, PhoneInput se monte avec sa valeur déjà présente.)
  const openDownloadModal = () => {
    setDlName((p) => p || signerIdentity.name);
    setDlEmail((p) => p || verifiedEmail || signerIdentity.email);
    setDlPhone((p) => p || verifiedPhone || signerIdentity.phone);
    setDlSent(false);
    setDlError('');
    setShowDownload(true);
  };

  const complete = useMemo(() => {
    const freeOk = signerFields.every((f) => {
      const v = (values[f.id] ?? '').trim();
      if (!v) return false;
      if (f.type === 'email' && !isValidEmail(v)) return false;
      return true;
    });
    const inlineOk = signerInline.every((f) => (inlineValues[f.fid] ?? '').trim() !== '');
    // Un signataire sans champ assigné peut tout de même signer (consentement)
    return signerFields.length + signerInline.length === 0 || (freeOk && inlineOk);
  }, [signerFields, signerInline, values, inlineValues]);

  const setVal = (id: string, v: string) => setValues((prev) => ({ ...prev, [id]: v }));
  const setInlineVal = (fid: string, v: string) => setInlineValues((prev) => ({ ...prev, [fid]: v }));

  // Verrou avant le pad signature : si vérification email requise et pas encore vérifié,
  // ouvre la modale de code et n'autorise la signature qu'au succès (promesse résolue par la modale).
  const onBeforeSign = (): Promise<boolean> => {
    const m = contract?.verification_method;
    if (!(m === 'email' || m === 'sms' || m === 'email_sms') || verified) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      verifResolver.current = resolve;
      setVerifOpen(true);
    });
  };
  const resolveVerif = (ok: boolean) => {
    verifResolver.current?.(ok);
    verifResolver.current = null;
  };

  // Réinitialise les champs (efface les préremplissages ; date/heure → aujourd'hui/maintenant)
  const resetSignerFields = () => {
    setValues((prev) => {
      const next = { ...prev };
      for (const f of signerFields) {
        next[f.id] = f.type === 'date' ? todayLocalISO() : f.type === 'time' ? nowLocalHM() : '';
      }
      return next;
    });
    setInlineValues((prev) => {
      const next = { ...prev };
      for (const f of signerInline) next[f.fid] = '';
      return next;
    });
    setInlineResetKey((k) => k + 1);
  };

  // Après signature confirmée (classique OU après paiement) : UI + copie PDF au proprio.
  // La copie au propriétaire n'est envoyée que lorsque TOUS les signataires ont signé (doc complet).
  const afterSigned = (allDone: boolean) => {
    setSigned(true);
    window.scrollTo({ top: 0, behavior: 'auto' });
    openDownloadModal();
    if (!allDone || !token) return;
    // Document complet → GÉNÉRATION DU CERTIFICAT (scellé serveur). Le serveur envoie ensuite
    // automatiquement le PDF final (doc + certificat) à TOUTES les parties par email (pièce jointe).
    setTimeout(async () => {
      setCertifying(true);
      setCertError('');
      try {
        const uri = await buildSignedPdfDataUri({
          sourceType: contract!.source_type,
          textPageEl: docRef.current,
          pdfPages,
          fields: contract!.fields.map((f) => ({ ...f, value: values[f.id] ?? f.value ?? '' })),
          images: contract!.images,
        });
        const r = await generateCertificate({ token, signedPdfDataUri: uri });
        if (!r.ok) setCertError("Le certificat n'a pas pu être généré automatiquement.");
      } catch (err) {
        console.error('[sign] certificat', err);
        setCertError("Le certificat n'a pas pu être généré automatiquement.");
      } finally {
        setCertifying(false);
      }
    }, 400);
  };

  // Téléchargement du certificat scellé (source unique stockée) ; sinon repli sur la copie PDF.
  const downloadCertificate = async () => {
    const url = token ? await getCertificateUrl({ token }) : null;
    if (url) window.open(url, '_blank');
    else openDownloadModal();
  };

  const submit = async () => {
    if (!contract || !complete) return;
    setSubmitting(true);
    try {
      const updates = signerFields.map((f) => ({ id: f.id, value: values[f.id] ?? '' }));
      await saveSignerFields(token!, updates, new Date().getTimezoneOffset());
      // Valeurs inline : on écrit UNIQUEMENT les champs de CE signataire (anti-race en mode parallèle)
      if (contract.signerId) {
        const myInline = Object.fromEntries(signerInline.map((f) => [f.fid, inlineValues[f.fid] ?? '']));
        await setSignerInlineValues(token!, myInline);
      }
      // email du signataire : champ libre OU inline
      const inlineVal = (t: string) => {
        const f = signerInline.find((x) => x.type === t);
        return f ? (inlineValues[f.fid] ?? '').trim() : '';
      };
      // Relie les champs remplis au contact (sauf signature/date/heure) + auto-enregistrement
      const valOf = (t: string) => {
        const f = signerFields.find((x) => x.type === t);
        const free = f ? (values[f.id] ?? '').trim() : '';
        return free || inlineVal(t);
      };
      const emailVal = valOf('email');
      if (emailVal) {
        saveSignerContact(token!, {
          name: valOf('name'),
          email: emailVal,
          phone: valOf('tel'),
          address: valOf('address'),
          siret: valOf('siret'),
          siren: valOf('siren'),
          tva: valOf('tva'),
          company_id: valOf('company_id'),
          ape: valOf('ape'),
        }).catch((err) => console.error('[sign] contact depuis champs', err));
      }

      const emailField = signerFields.find((f) => f.type === 'email');
      const emailForSign = (emailField ? values[emailField.id] : '') || inlineVal('email');

      // Signataire PAYEUR : créer le paiement → ouvrir la modale. Le marquage signé+payé se fait
      // côté serveur (sign-pay confirm) après paiement réussi (+ vérif si requise).
      if (contract.paymentRequired) {
        const { data, error: err } = await supabase.functions.invoke('sign-pay', { body: { action: 'create-payment', token } });
        if (err || !data?.ok || !data.client_secret) {
          window.alert('Paiement indisponible' + (data?.error ? ` (${data.error})` : '') + '.');
          setSubmitting(false);
          return;
        }
        setPayInfo({ clientSecret: data.client_secret, type: data.type === 'setup' ? 'setup' : 'payment', amount: data.amount ?? 0, currency: data.currency ?? 'eur' });
        setPayOpen(true);
        setSubmitting(false);
        return;
      }

      // Non-payeur : la signature est finalisée par le SERVEUR (ordre + vérif réellement passée) — non contournable.
      const { data: fdata, error: ferr } = await supabase.functions.invoke('sign-verify', {
        body: { action: 'finalize', token, email: emailForSign || undefined, tzOffset: new Date().getTimezoneOffset(), consent: "J'ai lu et j'accepte ce document" },
      });
      if (ferr || !fdata?.ok) {
        const code = fdata?.error;
        window.alert(
          code === 'not_your_turn'
            ? "Ce n'est pas encore votre tour de signer."
            : code === 'not_verified'
              ? 'La vérification doit être validée avant de signer.'
              : 'La signature a échoué, réessayez.',
        );
        setSubmitting(false);
        return;
      }
      afterSigned(othersAllSigned);
    } catch (e) {
      console.error('[sign] signature', e);
      window.alert('La signature a échoué, réessayez.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract) return;
    if (!dlName.trim()) {
      setDlError('Veuillez indiquer votre nom complet.');
      return;
    }
    if (!isValidEmail(dlEmail)) {
      setDlError('Email invalide.');
      return;
    }
    setDlSending(true);
    setDlError('');
    try {
      await emailSignedPdf({
        to: dlEmail.trim(),
        recipientName: dlName.trim(),
        title: contract.title,
        sourceType: contract.source_type,
        textPageEl: docRef.current,
        pdfPages,
        fields: contract.fields.map((f) => ({ ...f, value: values[f.id] ?? f.value ?? '' })),
      });
      // Enregistre le signataire dans les contacts du propriétaire (via Edge, scopé au proprio du contrat)
      saveSignerContact(token!, { name: dlName.trim(), email: dlEmail.trim(), phone: dlPhone.trim() || undefined }).catch((err) =>
        console.error('[sign] enregistrement contact', err),
      );
      // Journalise le téléchargement (IP serveur via sign-event)
      logDownloaded(token!, dlEmail.trim(), getVisitorId());
      setDlSent(true);
    } catch (err) {
      console.error('[sign] téléchargement copie', err);
      setDlError("L'envoi a échoué, réessayez.");
    } finally {
      setDlSending(false);
    }
  };

  const renderFields = (pageNum: number) =>
    (contract?.fields ?? [])
      .filter((f) => f.page === pageNum)
      .map((f) => (
        <FillableField
          key={f.id}
          field={f}
          value={values[f.id] ?? ''}
          onChange={(v) => setVal(f.id, v)}
          readOnly={signed || !myTurn || !(f.role === 'signer' && (f.signerIndex ?? 1) === mySignerIndex)}
          onBeforeSign={f.role === 'signer' && (f.signerIndex ?? 1) === mySignerIndex ? onBeforeSign : undefined}
        />
      ));

  const renderImages = (pageNum: number) =>
    (contract?.images ?? [])
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
    <div className="sign-landing min-h-screen bg-[#191E1E] pb-28 font-sans text-[#F3F4F6] antialiased selection:bg-[#CEFF8F] selection:text-[#191E1E]">
      <style>{`
        .sign-landing { font-family: "SF Pro Display","Helvetica Neue",Helvetica,Arial,Inter,sans-serif; }
        .sign-page { position:relative; width:210mm; min-height:297mm; padding:25mm 22mm; margin:0 auto;
          background:#fff; color:#1a1a1a; line-height:1.65; box-shadow:0 10px 50px rgba(0,0,0,.5); box-sizing:border-box; }
        .sign-doc { color:#1a1a1a; line-height:1.65; }
        ${PAGED_CSS}
        .sign-doc h1 { font-size:1.6rem; font-weight:700; margin:0 0 .75rem; }
        .sign-doc h2 { font-size:1.2rem; font-weight:700; margin:1.4rem 0 .5rem; }
        .sign-doc p { margin:.5rem 0; }
        .sign-doc ul { list-style:disc; padding-left:1.4rem; margin:.5rem 0; }
        .sign-doc ol { list-style:decimal; padding-left:1.4rem; margin:.5rem 0; }
        .sign-field { display:inline-flex; align-items:center; gap:4px; padding:1px 9px; margin:0 1px; border-radius:9999px;
          border:1px dashed #CEFF8F; background:#191E1E; color:#CEFF8F; font-size:.72em; font-weight:700;
          letter-spacing:.04em; text-transform:uppercase; vertical-align:baseline; white-space:nowrap; }
        .sign-field::before { content:"\\2736"; font-size:.85em; opacity:.8; }
        .sign-field[data-role="owner"] { border-color:#A0E7EC; color:#A0E7EC; }
        ${THEME_CSS}
      `}</style>

      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[#3A4242] bg-[#191E1E]/95 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center">
          <Logo className="text-[#CEFF8F]" />
          <span className="ml-2 text-sm font-semibold tracking-tight text-white">
            CloseOS <span className="font-normal text-[#A1A9A9]">| Sign</span>
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#A1A9A9]">
          <ShieldCheck className="h-3.5 w-3.5 text-[#CEFF8F]" /> Sécurisé &amp; RGPD
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-32 text-[#A1A9A9]">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : !contract ? (
        <div className="mx-auto max-w-md px-6 py-32 text-center">
          <h1 className="text-2xl font-semibold text-white">Lien invalide ou expiré</h1>
          <p className="mt-2 text-sm text-[#A1A9A9]">Ce document n’est plus disponible. Contactez l’expéditeur.</p>
        </div>
      ) : (
        <>
          {signed && (
            <div className="mx-auto mt-8 flex max-w-3xl items-center justify-between gap-3 rounded-lg border border-[#CEFF8F]/30 bg-[#CEFF8F]/10 px-5 py-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-[#CEFF8F]" />
                <div className="text-sm text-white">
                  Document signé. Merci !
                  {certifying ? ' Génération du certificat de preuve…' : certError ? ` ${certError}` : ' Le certificat de preuve est joint au document.'}
                </div>
              </div>
              <button
                onClick={downloadCertificate}
                disabled={certifying}
                className="flex shrink-0 items-center gap-1.5 rounded bg-[#CEFF8F] px-4 py-2 text-xs font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC] disabled:opacity-50"
              >
                {certifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Télécharger
              </button>
            </div>
          )}

          <div className="mx-auto max-w-3xl px-6 pt-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              {signed ? 'Document signé' : !myTurn ? 'En attente de votre tour' : 'Vous êtes invité(e) à signer'}
            </h1>
            <p className="mt-2 text-sm text-[#A1A9A9]">
              {contract.title} —{' '}
              {signed
                ? othersAllSigned
                  ? 'merci, le document est complet.'
                  : 'merci, votre signature est enregistrée. En attente des autres signataires.'
                : !myTurn
                  ? 'un signataire précédent doit signer avant vous. Vous serez notifié(e) par email.'
                  : 'relisez puis complétez les champs surlignés.'}
            </p>
          </div>

          {!signed && !myTurn && (
            <div className="mx-auto mt-4 flex max-w-3xl items-center gap-3 rounded-lg border border-[#F0B86E]/30 bg-[#F0B86E]/10 px-5 py-4">
              <Clock className="h-5 w-5 shrink-0 text-[#F0B86E]" />
              <div className="text-sm text-white">
                Signature à la suite : vous pourrez signer une fois que le ou les signataires précédents auront signé. Le document reste consultable.
              </div>
            </div>
          )}

          <div className="px-4 py-8 md:px-6">
            <div className="overflow-x-auto pb-2">
              {contract.source_type === 'pdf' ? (
                <div className="flex w-fit flex-col items-center gap-6" ref={docRef}>
                  {pdfPages.length === 0 ? (
                    <div className="flex h-64 items-center justify-center text-[#A1A9A9]">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Rendu du PDF…
                    </div>
                  ) : (
                    pdfPages.map((pg, idx) => (
                      <div key={idx} className="relative bg-white shadow-2xl" style={{ width: pg.width, height: pg.height }}>
                        <img src={pg.dataUrl} width={pg.width} height={pg.height} alt={`Page ${idx + 1}`} />
                        {renderImages(idx + 1)}
                        {renderFields(idx + 1)}
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <SignPagedDoc
                  html={contract.content_html}
                  docClass={contract.theme && contract.theme !== 'blank' ? `sign-doc theme-${contract.theme}` : 'sign-doc'}
                  docElRef={docRef}
                  inlineValues={inlineValues}
                  inlineRole={signed || !myTurn ? null : 'signer'}
                  inlineSignerIndex={mySignerIndex}
                  onInlineChange={setInlineVal}
                  inlineResetKey={inlineResetKey}
                >
                  {renderImages(1)}
                  {renderFields(1)}
                </SignPagedDoc>
              )}
            </div>
          </div>

          {!signed && myTurn && (
            <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#3A4242] bg-[#191E1E]/95 px-6 py-4 backdrop-blur-md">
              <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex cursor-pointer items-start gap-2 text-xs leading-snug text-[#F3F4F6] sm:max-w-xs">
                  <input
                    type="checkbox"
                    checked={consented}
                    onChange={(e) => setConsented(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#CEFF8F]"
                  />
                  <span>
                    J’ai lu et j’accepte ce document.
                    {!complete && <span className="mt-0.5 block text-[#A1A9A9]">Complétez aussi les champs surlignés.</span>}
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  {signerFields.length > 0 && (
                    <button
                      onClick={resetSignerFields}
                      disabled={submitting}
                      className="flex items-center gap-1.5 rounded border border-[#3A4242] px-3 py-3 text-xs font-medium text-[#A1A9A9] transition-colors hover:border-[#A1A9A9] hover:text-white disabled:opacity-40"
                      title="Effacer les champs préremplis"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Réinitialiser
                    </button>
                  )}
                  <button
                    onClick={submit}
                    disabled={!complete || !consented || submitting}
                    title={!consented ? 'Cochez « J’ai lu et j’accepte » pour signer' : !complete ? 'Complétez tous les champs' : ''}
                    className="flex items-center gap-2 rounded bg-[#CEFF8F] px-6 py-3 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC] disabled:opacity-40"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
                    {submitting ? 'Signature…' : 'Terminer et signer'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modale : vérification d'identité par code email (avant signature) */}
      <SignVerificationModal
        open={verifOpen}
        token={token ?? ''}
        channels={
          contract?.verification_method === 'email_sms'
            ? ['email', 'sms']
            : contract?.verification_method === 'sms'
              ? ['sms']
              : ['email']
        }
        onClose={() => {
          setVerifOpen(false);
          resolveVerif(false);
        }}
        onVerified={(r) => {
          setVerified(true);
          if (r.email) setVerifiedEmail(r.email);
          if (r.phone) setVerifiedPhone(r.phone);
          setVerifOpen(false);
          resolveVerif(true);
        }}
        onLocked={(info) => {
          setLocked(true);
          setLockInfo(info);
          setVerifOpen(false);
          resolveVerif(false);
        }}
      />

      {/* Modale de paiement (« Payé + signé ») */}
      <SignPaymentModal
        open={payOpen}
        clientSecret={payInfo?.clientSecret ?? ''}
        intentType={payInfo?.type ?? 'payment'}
        amount={payInfo?.amount ?? 0}
        currency={payInfo?.currency ?? 'eur'}
        token={token ?? ''}
        consent={consented}
        onClose={() => setPayOpen(false)}
        onPaid={() => {
          setPayOpen(false);
          afterSigned(othersAllSigned);
        }}
      />

      {/* Page verrouillée (3 essais ratés) : flou + cadenas */}
      {locked && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#191E1E]/80 px-4 backdrop-blur-xl">
          <div className="max-w-md rounded-2xl border border-[#3A4242] bg-[#222828] p-8 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#ef6b6b]/15">
              <Lock className="h-8 w-8 text-[#ef6b6b]" />
            </div>
            <h2 className="text-xl font-bold text-white">Accès bloqué</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#A1A9A9]">
              Trop de tentatives échouées
              {lockInfo.step === 2 ? ' lors de la saisie du code' : lockInfo.step === 1 ? ' lors de la saisie de vos informations' : ''}.
              Vous n’avez plus accès à ce document. Contactez l’émetteur pour qu’il rétablisse votre accès.
            </p>
          </div>
        </div>
      )}

      {/* Modale : recevoir une copie PDF par email */}
      {showDownload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-[#3A4242] bg-[#222828] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Recevoir une copie PDF</h3>
              <button onClick={() => setShowDownload(false)} className="text-[#A1A9A9] transition-colors hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {dlSent ? (
              <div>
                <div className="mb-5 flex items-center gap-3 rounded border border-[#CEFF8F]/30 bg-[#CEFF8F]/10 px-4 py-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[#CEFF8F]" />
                  <div className="text-sm text-white">
                    Copie envoyée à <span className="font-semibold">{dlEmail}</span>.
                  </div>
                </div>
                <button
                  onClick={() => setShowDownload(false)}
                  className="w-full rounded border border-[#3A4242] py-2.5 text-sm font-medium text-[#A1A9A9] transition-colors hover:border-[#A1A9A9] hover:text-white"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <form onSubmit={submitDownload} className="space-y-4">
                <p className="text-sm leading-relaxed text-[#A1A9A9]">
                  Indiquez votre nom et votre email : nous vous envoyons la copie PDF du document signé.
                </p>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
                  <input
                    type="text"
                    required
                    value={dlName}
                    onChange={(e) => setDlName(e.target.value)}
                    placeholder="Votre nom complet"
                    className="w-full rounded border border-[#3A4242] bg-[#191E1E] py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-[#A1A9A9]/40 focus:border-[#CEFF8F]"
                  />
                </div>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
                  <input
                    type="email"
                    required
                    value={dlEmail}
                    onChange={(e) => setDlEmail(e.target.value)}
                    placeholder="vous@exemple.fr"
                    className="w-full rounded border border-[#3A4242] bg-[#191E1E] py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-[#A1A9A9]/40 focus:border-[#CEFF8F]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">Téléphone <span className="text-[#A1A9A9]/60">(facultatif)</span></label>
                  <PhoneInput value={dlPhone} onChange={setDlPhone} />
                </div>
                {dlError && <p className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">{dlError}</p>}
                <button
                  type="submit"
                  disabled={dlSending}
                  className="flex w-full items-center justify-center gap-2 rounded bg-[#CEFF8F] py-2.5 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC] disabled:opacity-60"
                >
                  {dlSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {dlSending ? 'Envoi…' : 'Recevoir par email'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
