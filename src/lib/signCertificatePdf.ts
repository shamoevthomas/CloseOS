import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

/**
 * Mise en page du certificat de preuve CloseOS Sign (pages A4 dédiées), sans dépendance au
 * navigateur ni à Supabase : utilisée par la page signataire (chemin de secours) et par le
 * scellement serveur (api/sign-internal.ts, lot 3). Le journal sign_signature_events reste la
 * source de vérité ; ce module ne fait que le mettre en page.
 */

// Données de rendu renvoyées par l'action `seal`
export type CertData = {
  doc: { title: string; originalHash: string | null; sealedHash: string | null };
  method: string;
  signers: { index: number; name: string; email: string; phone: string | null; method: string; signedAt: string | null; paid: boolean }[];
  timeline: { type: string; at: string; signerIndex: number | null; ip: string | null; device: string }[];
  security: { type: string; at: string; signerIndex: number | null; ip: string | null; device: string; kind: string; step: number | null; attempt: number | null; attempted: string | null; reason: string | null }[];
  payments: { at: string; signerIndex: number | null; amount: number | null; currency: string; txn: string | null; mode: string | null }[];
  certificateId: string | null;
};

const LIME = '#CEFF8F';
const DARK = '#191E1E';
const GREY = '#6b7280';
const VERIFY_BASE = 'https://sign.closeos.fr/sign/verify';

const EVENT_LABEL: Record<string, string> = {
  created: 'Contrat créé',
  sent: 'Envoyé au signataire',
  opened: 'Document ouvert',
  email_access: 'Accès boîte mail prouvé',
  otp_sent: 'Code de vérification envoyé',
  otp_verified: 'Code de vérification validé',
  consent: 'Consentement explicite',
  signed: 'Signature scellée',
  paid: 'Paiement effectué',
  sealed: 'Document scellé',
  completed: 'Contrat complété',
  unlocked: 'Accès débloqué par l’émetteur',
  link_renewed: 'Nouveau lien émis par l’émetteur',
};

const fmtUTC = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} UTC`;
};
const fmtAmount = (cents: number | null, currency: string): string =>
  cents == null ? '—' : `${(cents / 100).toFixed(2).replace('.', ',')} ${(currency || 'eur').toUpperCase()}`;

/** Construit le PDF du certificat (pages dédiées) : data-URI (base64) ou octets (`bytes`). */
export async function buildCertificatePdf(data: CertData, output: 'datauri' | 'bytes' = 'datauri'): Promise<string | Uint8Array> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const W = doc.internal.pageSize.getWidth();
  const M = 16;
  let y = M;

  // ── En-tête ──
  doc.setFillColor(DARK);
  doc.rect(0, 0, W, 30, 'F');
  doc.setTextColor('#FFFFFF');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('CloseOS', M, 13);
  doc.setTextColor(LIME);
  doc.text('Sign', M + doc.getTextWidth('CloseOS ') + 1, 13);
  doc.setTextColor('#FFFFFF');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Certificat de preuve', M, 22);
  doc.setFontSize(8);
  doc.setTextColor('#A1A9A9');
  doc.text(`ID : ${data.certificateId ?? '—'}`, W - M, 13, { align: 'right' });
  doc.text(`Généré le ${fmtUTC(new Date().toISOString())}`, W - M, 19, { align: 'right' });
  y = 38;

  const sectionTitle = (t: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(DARK);
    doc.text(t, M, y);
    y += 2;
    doc.setDrawColor(LIME);
    doc.setLineWidth(0.6);
    doc.line(M, y, M + 28, y);
    y += 5;
  };
  const afterTable = () => {
    // @ts-expect-error lastAutoTable injecté par le plugin
    y = (doc.lastAutoTable?.finalY ?? y) + 8;
  };
  const tableOpts = (head: string[][], bodyRows: (string | number)[][]) => ({
    startY: y,
    head,
    body: bodyRows,
    theme: 'grid' as const,
    margin: { left: M, right: M },
    styles: { fontSize: 8, cellPadding: 1.8, textColor: '#1a1a1a', lineColor: '#e2e5e5' },
    headStyles: { fillColor: '#222828', textColor: '#FFFFFF', fontStyle: 'bold' as const, fontSize: 8 },
    alternateRowStyles: { fillColor: '#f6f8f5' },
  });

  // ── Document ──
  sectionTitle('Document');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor('#1a1a1a');
  doc.text(`Titre : ${data.doc.title}`, M, y);
  y += 5;
  doc.setFontSize(7.5);
  doc.setTextColor(GREY);
  const hash = (label: string, h: string | null) => {
    doc.text(`${label} (SHA-256) :`, M, y);
    y += 3.5;
    doc.text(h ? h.match(/.{1,64}/g)!.join('\n') : '—', M + 2, y);
    y += (h ? Math.ceil(h.length / 64) : 1) * 3.5 + 2;
  };
  hash('Empreinte du document original', data.doc.originalHash);
  hash('Empreinte du document scellé (signé)', data.doc.sealedHash);
  y += 3;

  // ── Signataires ──
  sectionTitle('Signataires');
  autoTable(
    doc,
    tableOpts(
      [['#', 'Nom', 'Email vérifié', 'Téléphone', 'Méthode', 'Signé le (UTC)']],
      data.signers.map((s) => [s.index, s.name, s.email, s.phone ?? '—', s.method, fmtUTC(s.signedAt)]),
    ),
  );
  afterTable();

  // ── Chronologie ──
  sectionTitle('Chronologie horodatée');
  autoTable(
    doc,
    tableOpts(
      [['Horodatage (UTC)', 'Événement', 'Sign.', 'IP', 'Appareil']],
      data.timeline.map((e) => [fmtUTC(e.at), EVENT_LABEL[e.type] ?? e.type, e.signerIndex ?? '—', e.ip ?? '—', e.device]),
    ),
  );
  afterTable();

  // ── Paiement ──
  if (data.payments.length) {
    sectionTitle('Preuve de paiement');
    autoTable(
      doc,
      tableOpts(
        [['Date (UTC)', 'Signataire', 'Montant', 'Type', 'Transaction']],
        data.payments.map((p) => [fmtUTC(p.at), p.signerIndex ?? '—', fmtAmount(p.amount, p.currency), p.mode === 'subscription' ? 'Abonnement' : 'Paiement unique', p.txn ?? '—']),
      ),
    );
    afterTable();
  }

  // ── Sécurité ──
  if (data.security.length) {
    sectionTitle('Événements de sécurité');
    autoTable(
      doc,
      tableOpts(
        [['Horodatage (UTC)', 'Type', 'Détail', 'IP']],
        data.security.map((s) => {
          const detail =
            s.kind === 'verification_locked'
              ? `Accès bloqué (étape ${s.step ?? '?'})`
              : s.kind === 'verification_failed'
                ? `Échec vérif. étape ${s.step ?? '?'}${s.attempt ? `, tentative ${s.attempt}` : ''}${s.attempted ? ` — ${s.attempted}` : ''}`
                : s.kind;
          return [fmtUTC(s.at), s.kind === 'verification_locked' ? 'Blocage' : 'Tentative échouée', detail, s.ip ?? '—'];
        }),
      ),
    );
    afterTable();
  }

  // ── Pied : attestation + QR de vérification ──
  if (y > 250) {
    doc.addPage();
    y = M;
  }
  const verifyUrl = data.certificateId ? `${VERIFY_BASE}/${data.certificateId}` : VERIFY_BASE;
  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 200 });
  } catch {
    /* QR best-effort */
  }
  doc.setDrawColor('#e2e5e5');
  doc.setLineWidth(0.3);
  doc.line(M, y, W - M, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(DARK);
  doc.text('Ce certificat atteste', M, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor('#1a1a1a');
  const attest = doc.splitTextToSize(
    "que le document identifié ci-dessus a été présenté, consulté et signé électroniquement par le(s) signataire(s) listé(s), selon la chronologie horodatée et les preuves enregistrées. Les empreintes SHA-256 garantissent l'intégrité du document original et du document scellé.",
    qrDataUrl ? W - 2 * M - 36 : W - 2 * M,
  );
  doc.text(attest, M, y);
  if (qrDataUrl) {
    doc.addImage(qrDataUrl, 'PNG', W - M - 30, y - 4, 30, 30);
    doc.setFontSize(6.5);
    doc.setTextColor(GREY);
    doc.text('Vérifier en ligne', W - M - 15, y + 28, { align: 'center' });
  }
  y += attest.length * 4 + 10;
  doc.setFontSize(7.5);
  doc.setTextColor(GREY);
  doc.text(`Identifiant du certificat : ${data.certificateId ?? '—'}`, M, y);
  y += 4;
  doc.text('Niveau : signature électronique simple documentée.', M, y);

  return output === 'bytes' ? new Uint8Array(doc.output('arraybuffer')) : doc.output('datauristring');
}

