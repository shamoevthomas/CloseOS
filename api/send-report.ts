import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const brevoApiKey = process.env.BREVO_API_KEY || '';

function fmtCur(v: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}
function fmtPct(v: number): string { return `${v.toFixed(1)}%`; }

// ─── Colors ───
const C = {
  black: [17, 17, 17] as [number, number, number],
  gray: [116, 120, 120] as [number, number, number],
  lightGray: [196, 199, 199] as [number, number, number],
  bg: [245, 243, 242] as [number, number, number],
  bgAlt: [251, 249, 248] as [number, number, number],
  line: [240, 238, 236] as [number, number, number],
  green: [0, 108, 73] as [number, number, number],
  red: [186, 26, 26] as [number, number, number],
  amber: [255, 185, 95] as [number, number, number],
  dark: [27, 28, 27] as [number, number, number],
  darkGray: [68, 71, 72] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

const STAGE_COLORS: Record<string, [number, number, number]> = {
  prospect: C.green, qualified: C.amber, unqualified: C.lightGray,
  followup: C.dark, won: C.green, lost: C.red,
  noanswer: C.gray, noshow: C.darkGray,
};

const STAGE_LABELS: Record<string, string> = {
  prospect: 'Nouveau Lead', qualified: 'Qualifié', unqualified: 'Non-Qualifié',
  followup: 'Follow Up', won: 'Gagné', lost: 'Perdu',
  noanswer: 'Pas de Réponse', noshow: 'No Show',
};

const LOSS_COLORS: [number, number, number][] = [[99,102,241],[245,158,11],[139,92,246],[100,116,139],[239,68,68],[249,115,22],[161,161,170]];

interface ReportData {
  orgName: string; periodLabel: string; ownerName: string;
  totalLeads: number; wonCount: number; lostCount: number; noshowCount: number;
  qualifiedCount: number; followupCount: number; activeCount: number;
  totalCA: number; avgDeal: number; closingRate: number; noshowRate: number; lostRate: number;
  totalPipeline: number; commission: number;
  totalAppts: number; doneAppts: number; pendingAppts: number; confirmedAppts: number; cancelledAppts: number; showUpRate: number; cancelRate: number;
  stageData: { stage: string; count: number; pct: number }[];
  lossData: { reason: string; count: number; pct: number }[];
  campStats: { name: string; active: boolean; date: string; views: number; leads: number; won: number; ca: number; conv: number; commission: number }[];
  memberStats: { name: string; role: string; wins: number; leads: number; ca: number; setterLeads: number; setterBooked: number }[];
  caPerCamp: { name: string; ca: number }[];
}

const PERIOD_LABELS_FR: Record<string, string> = {
  week: 'Cette semaine', month: 'Ce mois', quarter: 'Ce trimestre', year: 'Cette année', all: 'Depuis toujours',
};

function getPeriodCutoff(period: string): Date | null {
  const now = new Date();
  switch (period) {
    case 'week': {
      const d = new Date(now); d.setDate(d.getDate() - 7); return d;
    }
    case 'month': {
      const d = new Date(now); d.setMonth(d.getMonth() - 1); return d;
    }
    case 'quarter': {
      const d = new Date(now); d.setMonth(d.getMonth() - 3); return d;
    }
    case 'year': {
      const d = new Date(now); d.setFullYear(d.getFullYear() - 1); return d;
    }
    case 'all': return null;
    default: return null;
  }
}

function getPeriodLabel(period: string): string {
  const now = new Date();
  const cutoff = getPeriodCutoff(period);
  const fmtDate = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  if (!cutoff) return 'Depuis toujours';
  return `${fmtDate(cutoff)} — ${fmtDate(now)}`;
}

function buildCSV(d: ReportData): string {
  const sep = ';';
  const lines: string[] = [];
  const row = (...cols: (string | number)[]) => lines.push(cols.map(c => `"${String(c).replace(/"/g, '""')}"`).join(sep));

  row('Rapport CloseOS', d.orgName, d.periodLabel);
  lines.push('');

  row('KPIs Principaux');
  row('Métrique', 'Valeur');
  row('CA Généré', fmtCur(d.totalCA));
  row('Ventes', d.wonCount);
  row('Panier Moyen', fmtCur(d.avgDeal));
  row('Taux de Closing', fmtPct(d.closingRate));
  row('Commission estimée', fmtCur(d.commission));
  lines.push('');

  row('KPIs Secondaires');
  row('Métrique', 'Valeur');
  row('Total Leads', d.totalLeads);
  row('Show Up', d.doneAppts);
  row('No Show', d.noshowCount);
  row('Taux de perte', fmtPct(d.lostRate));
  row('Taux de no-show', fmtPct(d.noshowRate));
  lines.push('');

  row('Répartition des leads par étape');
  row('Étape', 'Nombre', '%');
  d.stageData.forEach(s => row(STAGE_LABELS[s.stage] || s.stage, s.count, `${s.pct}%`));
  lines.push('');

  if (d.lossData.length > 0) {
    row('Raisons de perte');
    row('Raison', 'Nombre', '%');
    d.lossData.forEach(l => row(l.reason, l.count, `${l.pct}%`));
    lines.push('');
  }

  if (d.caPerCamp.length > 0) {
    row('CA par campagne');
    row('Campagne', 'CA');
    d.caPerCamp.forEach(c => row(c.name, fmtCur(c.ca)));
    lines.push('');
  }

  if (d.campStats.length > 0) {
    row('Performance des Campagnes');
    row('Campagne', 'Statut', 'Vues', 'Conv.', 'Leads', 'Gagnés', 'CA', 'Commission');
    d.campStats.forEach(c => row(c.name, c.active ? 'Active' : 'Paused', c.views, fmtPct(c.conv), c.leads, c.won, fmtCur(c.ca), fmtCur(c.commission)));
    row('Total', '', d.campStats.reduce((s, c) => s + c.views, 0), '', d.campStats.reduce((s, c) => s + c.leads, 0), d.campStats.reduce((s, c) => s + c.won, 0), fmtCur(d.totalCA), fmtCur(d.commission));
    lines.push('');
  }

  if (d.memberStats.length > 0) {
    row("Performance de l'Équipe");
    row('Membre', 'Rôle', 'Leads', 'Gagnés', 'CA', 'Leads settés', 'RDV bookés');
    d.memberStats.forEach(mb => row(mb.name, mb.role, mb.leads, mb.wins, fmtCur(mb.ca), mb.setterLeads, mb.setterBooked));
    lines.push('');
  }

  row('Résumé Financier');
  row('Métrique', 'Valeur');
  row('Taux de Closing', fmtPct(d.closingRate));
  row('Panier Moyen', fmtCur(d.avgDeal));
  row('Show Up Rate', fmtPct(d.showUpRate));
  row('Valeur Pipeline', fmtCur(d.totalPipeline));
  lines.push('');

  row('Rendez-vous');
  row('Métrique', 'Valeur');
  row('Total RDV', d.totalAppts);
  row('Terminés', d.doneAppts);
  row('En attente', d.pendingAppts);
  row('Confirmés', d.confirmedAppts);
  row('Annulés', d.cancelledAppts);
  lines.push('');

  row('Pipeline Détaillé');
  row('Étape', 'Nombre');
  row('Prospects', d.stageData.find(s => s.stage === 'prospect')?.count || 0);
  row('Qualifiés', d.qualifiedCount);
  row('Follow Up', d.followupCount);
  row('Gagnés', d.wonCount);
  row('Perdus', d.lostCount);
  row('No Show', d.noshowCount);

  return Buffer.from('\uFEFF' + lines.join('\n'), 'utf-8').toString('base64');
}

function buildPDF(d: ReportData): string {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const m = 18;
  const cw = W - m * 2;
  let y = 16;

  const checkPage = (need: number) => {
    if (y + need > H - 15) { doc.addPage(); y = 16; }
  };

  const sectionTitle = (title: string) => {
    checkPage(20);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...C.black);
    doc.text(title, m, y); y += 8;
  };

  const drawBar = (_x: number, yy: number, _w: number, h: number, color: [number, number, number], maxW: number, val: number, maxVal: number) => {
    doc.setFillColor(...C.line); doc.roundedRect(_x, yy, maxW, h, 1.5, 1.5, 'F');
    const bw = maxVal > 0 ? Math.max((val / maxVal) * maxW, 2) : 2;
    doc.setFillColor(...color); doc.roundedRect(_x, yy, bw, h, 1.5, 1.5, 'F');
  };

  // HEADER
  doc.setFillColor(17, 17, 17);
  doc.roundedRect(m, y, cw, 28, 4, 4, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(...C.white);
  doc.text('CloseOS', m + 12, y + 12);
  doc.setFontSize(9); doc.setTextColor(200, 200, 200);
  doc.text('Rapport', m + 12, y + 19);
  doc.setTextColor(...C.white); doc.setFontSize(10);
  doc.text(d.orgName, W - m - 12, y + 12, { align: 'right' });
  doc.setFontSize(8); doc.setTextColor(200, 200, 200);
  doc.text(d.periodLabel, W - m - 12, y + 19, { align: 'right' });
  y += 36;

  // KPIs PRINCIPAUX
  sectionTitle('KPIs Principaux');
  const mainKpis = [
    { label: 'CA Généré', value: fmtCur(d.totalCA) },
    { label: 'Ventes', value: String(d.wonCount), sub: `${fmtCur(d.avgDeal)} moy.` },
    { label: 'Taux de Closing', value: fmtPct(d.closingRate) },
    { label: 'Commission estimée', value: fmtCur(d.commission) },
  ];
  const cardW = (cw - 9) / 4;
  mainKpis.forEach((kpi, i) => {
    const x = m + i * (cardW + 3);
    doc.setFillColor(...C.bg); doc.roundedRect(x, y, cardW, 22, 3, 3, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...C.black);
    doc.text(kpi.value, x + cardW / 2, y + 10, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...C.gray);
    doc.text(kpi.label.toUpperCase(), x + cardW / 2, y + 16, { align: 'center' });
    if (kpi.sub) {
      doc.setFontSize(5.5); doc.text(kpi.sub, x + cardW / 2, y + 20, { align: 'center' });
    }
  });
  y += 28;

  // KPIs SECONDAIRES
  const secKpis = [
    { label: 'Total Leads', value: String(d.totalLeads) },
    { label: 'Show Up', value: String(d.doneAppts) },
    { label: 'No Show', value: String(d.noshowCount), color: C.red },
    { label: 'Taux de perte', value: fmtPct(d.lostRate) },
  ];
  secKpis.forEach((kpi, i) => {
    const x = m + i * (cardW + 3);
    doc.setFillColor(...C.bg); doc.roundedRect(x, y, cardW, 16, 3, 3, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...(kpi.color || C.black));
    doc.text(kpi.value, x + cardW / 2, y + 7.5, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...C.gray);
    doc.text(kpi.label.toUpperCase(), x + cardW / 2, y + 12.5, { align: 'center' });
  });
  y += 22;

  // RÉPARTITION DES LEADS
  sectionTitle('Répartition des leads par étape');
  const stageMax = Math.max(...d.stageData.map(s => s.count), 1);
  const halfW = cw / 2 - 4;
  d.stageData.forEach(s => {
    const color = STAGE_COLORS[s.stage] || C.gray;
    doc.setFillColor(...color); doc.circle(m + 2, y + 2.5, 1.5, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.dark);
    doc.text(STAGE_LABELS[s.stage] || s.stage, m + 6, y + 3.5);
    drawBar(m + 42, y, 0, 5, color, halfW - 56, s.count, stageMax);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...C.black);
    doc.text(`${s.count}`, m + halfW - 10, y + 3.5, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...C.gray);
    doc.text(`${s.pct}%`, m + halfW, y + 3.5, { align: 'right' });
    y += 7;
  });
  y += 4;

  // CA PAR CAMPAGNE
  if (d.caPerCamp.length > 0) {
    sectionTitle('CA par campagne');
    const campMax = Math.max(...d.caPerCamp.map(c => c.ca), 1);
    const barColors: [number, number, number][] = [C.green, C.dark, C.amber, C.gray, C.lightGray];
    d.caPerCamp.slice(0, 8).forEach((c, i) => {
      const color = barColors[i % barColors.length];
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...C.black);
      const name = c.name.length > 28 ? c.name.slice(0, 28) + '…' : c.name;
      doc.text(name, m, y + 3);
      doc.setTextColor(...color);
      doc.text(fmtCur(c.ca), W - m, y + 3, { align: 'right' });
      y += 5;
      drawBar(m, y, 0, 4, color, cw, c.ca, campMax);
      y += 7;
    });
    y += 4;
  }

  // RAISONS DE PERTE
  if (d.lossData.length > 0) {
    sectionTitle('Raisons de perte');
    d.lossData.forEach((l, i) => {
      const color = LOSS_COLORS[i % LOSS_COLORS.length];
      doc.setFillColor(...color); doc.circle(m + 2, y + 2, 1.5, 'F');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.dark);
      doc.text(l.reason, m + 6, y + 3);
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.black);
      doc.text(String(l.count), W - m - 14, y + 3, { align: 'right' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...C.gray);
      doc.text(`${l.pct}%`, W - m, y + 3, { align: 'right' });
      y += 7;
    });
    y += 4;
  }

  // PERFORMANCE DES CAMPAGNES
  if (d.campStats.length > 0) {
    checkPage(30);
    sectionTitle('Performance des Campagnes');
    autoTable(doc, {
      startY: y,
      margin: { left: m, right: m },
      head: [['Campagne', 'Statut', 'Vues', 'Conv.', 'Leads', 'Gagnés', 'CA', 'Comm.']],
      body: [
        ...d.campStats.map(c => [
          c.name, c.active ? 'Active' : 'Paused', String(c.views),
          fmtPct(c.conv), String(c.leads), String(c.won), fmtCur(c.ca), fmtCur(c.commission),
        ]),
        ['Total', '', String(d.campStats.reduce((s, c) => s + c.views, 0)),
          '', String(d.campStats.reduce((s, c) => s + c.leads, 0)),
          String(d.campStats.reduce((s, c) => s + c.won, 0)),
          fmtCur(d.totalCA), fmtCur(d.commission)],
      ],
      styles: { font: 'helvetica', fontSize: 7, cellPadding: 2.5 },
      headStyles: { fillColor: C.bg, textColor: C.gray, fontStyle: 'bold', fontSize: 6.5 },
      bodyStyles: { textColor: C.dark },
      columnStyles: {
        0: { cellWidth: 'auto', fontStyle: 'bold' },
        1: { cellWidth: 16, halign: 'center' },
        2: { cellWidth: 16, halign: 'center' },
        3: { cellWidth: 14, halign: 'center' },
        4: { cellWidth: 14, halign: 'center' },
        5: { cellWidth: 14, halign: 'center' },
        6: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
        7: { cellWidth: 22, halign: 'right' },
      },
      alternateRowStyles: { fillColor: C.bgAlt },
      didParseCell: (data: any) => {
        if (data.row.index === d.campStats.length) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = C.bg;
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // PERFORMANCE DE L'ÉQUIPE
  if (d.memberStats.length > 0) {
    checkPage(30);
    sectionTitle("Performance de l'Équipe");
    autoTable(doc, {
      startY: y,
      margin: { left: m, right: m },
      head: [['Membre', 'Rôle', 'Leads', 'Gagnés', 'CA', 'Leads settés', 'RDV bookés']],
      body: d.memberStats.map(mb => [
        mb.name, mb.role, String(mb.leads), String(mb.wins), fmtCur(mb.ca),
        String(mb.setterLeads), String(mb.setterBooked),
      ]),
      styles: { font: 'helvetica', fontSize: 7, cellPadding: 2.5 },
      headStyles: { fillColor: C.bg, textColor: C.gray, fontStyle: 'bold', fontSize: 6.5 },
      bodyStyles: { textColor: C.dark },
      columnStyles: {
        0: { cellWidth: 'auto', fontStyle: 'bold' },
        1: { cellWidth: 24 },
        2: { halign: 'center', cellWidth: 14 },
        3: { halign: 'center', cellWidth: 14 },
        4: { halign: 'right', cellWidth: 22, fontStyle: 'bold' },
        5: { halign: 'center', cellWidth: 20 },
        6: { halign: 'center', cellWidth: 20 },
      },
      alternateRowStyles: { fillColor: C.bgAlt },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // RÉSUMÉ FINANCIER + RENDEZ-VOUS
  checkPage(50);
  sectionTitle('Résumé Financier & Rendez-vous');
  const boxW = (cw - 6) / 2;
  doc.setFillColor(17, 17, 17); doc.roundedRect(m, y, boxW, 38, 3, 3, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...C.white);
  doc.text('Résumé Financier', m + 8, y + 8);
  const finItems = [
    ['Taux de Closing', fmtPct(d.closingRate)],
    ['Panier Moyen', fmtCur(d.avgDeal)],
    ['Show Up Rate', fmtPct(d.showUpRate)],
    ['Valeur Pipeline', fmtCur(d.totalPipeline)],
  ];
  finItems.forEach((item, i) => {
    const iy = y + 14 + i * 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(180, 180, 180);
    doc.text(item[0].toUpperCase(), m + 8, iy);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...C.white);
    doc.text(item[1], m + boxW - 8, iy, { align: 'right' });
  });

  const rx = m + boxW + 6;
  doc.setFillColor(...C.bg); doc.roundedRect(rx, y, boxW, 38, 3, 3, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...C.black);
  doc.text('Rendez-vous', rx + 8, y + 8);
  const rdvItems = [
    ['Total RDV', String(d.totalAppts)],
    ['Terminés', String(d.doneAppts)],
    ['En attente', String(d.pendingAppts)],
    ['Confirmés', String(d.confirmedAppts)],
    ['Annulés', String(d.cancelledAppts)],
  ];
  rdvItems.forEach((item, i) => {
    const iy = y + 14 + i * 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...C.gray);
    doc.text(item[0], rx + 8, iy);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...C.black);
    doc.text(item[1], rx + boxW - 8, iy, { align: 'right' });
  });
  y += 44;

  // PIPELINE DÉTAILLÉ
  checkPage(25);
  sectionTitle('Pipeline Détaillé');
  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.gray);
  doc.text(`Valeur totale : ${fmtCur(d.totalPipeline)}`, m + cw, y - 6, { align: 'right' });

  const barY = y;
  const barTotalH = 5;
  doc.setFillColor(...C.line); doc.roundedRect(m, barY, cw, barTotalH, 2, 2, 'F');
  let barX = m;
  d.stageData.forEach((s, i) => {
    if (s.count === 0 || d.totalLeads === 0) return;
    const w = (s.count / d.totalLeads) * cw;
    const color = STAGE_COLORS[s.stage] || C.gray;
    doc.setFillColor(...color);
    if (i === 0) doc.roundedRect(barX, barY, w, barTotalH, 2, 2, 'F');
    else doc.rect(barX, barY, w, barTotalH, 'F');
    barX += w;
  });
  y += barTotalH + 8;

  const pipeCards = [
    { label: 'Prospects', value: d.stageData.find(s => s.stage === 'prospect')?.count || 0 },
    { label: 'Qualifiés', value: d.qualifiedCount },
    { label: 'Follow Up', value: d.followupCount },
    { label: 'Gagnés', value: d.wonCount },
    { label: 'Perdus', value: d.lostCount },
    { label: 'No Show', value: d.noshowCount },
  ];
  const pcW = (cw - 15) / 6;
  pipeCards.forEach((pc, i) => {
    const px = m + i * (pcW + 3);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...C.black);
    doc.text(String(pc.value), px + pcW / 2, y + 2, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); doc.setTextColor(...C.gray);
    doc.text(pc.label.toUpperCase(), px + pcW / 2, y + 7, { align: 'center' });
  });
  y += 14;

  // FOOTER
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(180, 180, 180);
    doc.text('CloseOS — Rapport généré automatiquement', m, H - 8);
    doc.text(`Page ${p}/${totalPages}`, W - m, H - 8, { align: 'right' });
  }

  return doc.output('datauristring').split(',')[1];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { user_id, formats, period } = req.body as { user_id: string; formats: string[]; period: string };
    if (!user_id || !formats || !period) return res.status(400).json({ error: 'user_id, formats, and period are required' });

    // Get owner info
    const { data: owner } = await supabase.from('business_users').select('id, full_name, email').eq('id', user_id).single();
    if (!owner?.email) return res.status(404).json({ error: 'User not found' });

    const { data: settings } = await supabase
      .from('business_settings').select('company_name').eq('user_id', user_id).maybeSingle();
    const orgName = settings?.company_name || 'CloseOS Business';

    const cutoff = getPeriodCutoff(period);
    const cutoffISO = cutoff ? cutoff.toISOString() : null;
    const periodLabel = getPeriodLabel(period);
    const periodLabelShort = PERIOD_LABELS_FR[period] || period;

    const COMMISSION_RATE = 10;

    const [membersRes, prospectsRes, campaignsRes, appointmentsRes, formulasRes] = await Promise.all([
      supabase.from('business_team_members').select('id, first_name, last_name, role, joined_at, user_id').eq('business_owner_id', user_id),
      supabase.from('business_prospects').select('id, stage, value, created_at, campaign_id, assigned_to, assigned_setter, loss_reason, loss_details, call_notes, contact, stripe_subscription_id, subscription_amount, formula_id').eq('user_id', user_id),
      supabase.from('business_campaigns').select('id, name, views, is_active, created_at').eq('user_id', user_id),
      supabase.from('business_appointments').select('id, status, date, campaign_id, created_at').eq('user_id', user_id),
      supabase.from('business_formulas').select('id, billing_type').eq('user_id', user_id),
    ]);

    const members = membersRes.data || [];
    const allProspects = prospectsRes.data || [];
    const campaigns = campaignsRes.data || [];
    const allAppointments = appointmentsRes.data || [];
    const formulaBillingTypes: Record<string, string> = {};
    (formulasRes.data || []).forEach((f: any) => { formulaBillingTypes[f.id] = f.billing_type || 'one_time'; });

    const prospectCA = (p: any): number => {
      const bt = p.formula_id ? formulaBillingTypes[p.formula_id] : null;
      if (bt === 'subscription' && p.stripe_subscription_id && p.subscription_amount) return Number(p.subscription_amount) || 0;
      return Number(p.value) || 0;
    };

    const prospects = cutoffISO ? allProspects.filter(p => p.created_at >= cutoffISO) : allProspects;
    const appointments = cutoffISO ? allAppointments.filter(a => a.created_at >= cutoffISO) : allAppointments;

    const wonLeads = prospects.filter(p => p.stage === 'won');
    const lostLeads = prospects.filter(p => p.stage === 'lost');
    const noshowLeads = prospects.filter(p => p.stage === 'noshow');
    const qualifiedLeads = prospects.filter(p => p.stage === 'qualified');
    const followupLeads = prospects.filter(p => p.stage === 'followup');
    const totalCA = wonLeads.reduce((s, p) => s + prospectCA(p), 0);
    const avgDeal = wonLeads.length > 0 ? totalCA / wonLeads.length : 0;
    const totalDecided = wonLeads.length + lostLeads.length + noshowLeads.length;
    const closingRate = totalDecided > 0 ? (wonLeads.length / totalDecided) * 100 : 0;
    const noshowEligible = prospects.filter(p => !['prospect', 'unqualified', 'noanswer'].includes(p.stage)).length;
    const noshowRate = noshowEligible > 0 ? (noshowLeads.length / noshowEligible) * 100 : 0;
    const lostRate = totalDecided > 0 ? (lostLeads.length / totalDecided) * 100 : 0;
    const totalPipeline = prospects.filter(p => p.stage !== 'unqualified').reduce((s, p) => s + prospectCA(p), 0);
    const commission = totalCA * (COMMISSION_RATE / 100);

    const doneAppts = appointments.filter(a => a.status === 'done').length;
    const pendingAppts = appointments.filter(a => a.status === 'pending').length;
    const confirmedAppts = appointments.filter(a => a.status === 'confirmed').length;
    const cancelledAppts = appointments.filter(a => a.status === 'cancelled').length;
    const showUpRate = appointments.length > 0 ? (doneAppts / appointments.length) * 100 : 0;

    const stages = ['prospect', 'qualified', 'unqualified', 'followup', 'won', 'lost', 'noanswer', 'noshow'];
    const stageData = stages.map(s => {
      const count = prospects.filter(p => p.stage === s).length;
      return { stage: s, count, pct: prospects.length > 0 ? Math.round((count / prospects.length) * 100) : 0 };
    }).filter(s => s.count > 0);

    const lostProspects = prospects.filter(p => p.stage === 'lost');
    const lossCounts: Record<string, number> = {};
    lostProspects.forEach(p => {
      let reason = p.loss_reason as string | null;
      if (!reason && Array.isArray(p.call_notes)) {
        for (let i = (p.call_notes as any[]).length - 1; i >= 0; i--) {
          const match = (p.call_notes as any[])[i].content?.match(/- Motif: (.+)/);
          if (match) { reason = match[1]; break; }
        }
      }
      if (reason) lossCounts[reason] = (lossCounts[reason] || 0) + 1;
    });
    const lossTotal = Object.values(lossCounts).reduce((s, v) => s + v, 0);
    const lossData = Object.entries(lossCounts)
      .map(([reason, count]) => ({ reason, count, pct: lossTotal > 0 ? Math.round((count / lossTotal) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);

    const campStats = campaigns.map(c => {
      const cp = prospects.filter(p => p.campaign_id === c.id);
      const cw2 = cp.filter(p => p.stage === 'won');
      const ca = cw2.reduce((s, p) => s + prospectCA(p), 0);
      return {
        name: c.name, active: c.is_active, date: c.created_at, views: c.views,
        leads: cp.length, won: cw2.length, ca, conv: c.views > 0 ? (cp.length / c.views) * 100 : 0,
        commission: ca * (COMMISSION_RATE / 100),
      };
    }).sort((a, b) => b.ca - a.ca);

    const caPerCamp = campStats.filter(c => c.ca > 0).map(c => ({ name: c.name, ca: c.ca }));

    const memberStats = members.map(mb => {
      const mp = prospects.filter(p => p.assigned_to === mb.id);
      const mw = mp.filter(p => p.stage === 'won');
      const sp = prospects.filter(p => p.assigned_setter === mb.id);
      const sb = sp.filter(p => ['qualified', 'won', 'lost', 'noshow', 'followup'].includes(p.stage));
      return {
        name: `${mb.first_name} ${mb.last_name}`.trim(), role: mb.role,
        wins: mw.length, leads: mp.length, ca: mw.reduce((s, p) => s + prospectCA(p), 0),
        setterLeads: sp.length, setterBooked: sb.length,
      };
    });

    const reportData: ReportData = {
      orgName, periodLabel, ownerName: owner.full_name || 'Owner',
      totalLeads: prospects.length, wonCount: wonLeads.length, lostCount: lostLeads.length,
      noshowCount: noshowLeads.length, qualifiedCount: qualifiedLeads.length,
      followupCount: followupLeads.length, activeCount: prospects.filter(p => ['prospect', 'qualified', 'followup'].includes(p.stage)).length,
      totalCA, avgDeal, closingRate, noshowRate, lostRate, totalPipeline, commission,
      totalAppts: appointments.length, doneAppts, pendingAppts, confirmedAppts, cancelledAppts, showUpRate,
      cancelRate: appointments.length > 0 ? (cancelledAppts / appointments.length) * 100 : 0,
      stageData, lossData, campStats, memberStats, caPerCamp,
    };

    // Build attachments based on selected formats
    const attachments: { content: string; name: string }[] = [];
    const dateStr = new Date().toISOString().slice(0, 10);

    if (formats.includes('pdf')) {
      attachments.push({ content: buildPDF(reportData), name: `CloseOS-Rapport-${dateStr}.pdf` });
    }
    if (formats.includes('csv')) {
      attachments.push({ content: buildCSV(reportData), name: `CloseOS-Rapport-${dateStr}.csv` });
    }

    const formatList = formats.map(f => f.toUpperCase()).join(' + ');

    // Email HTML
    const htmlContent = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Manrope:wght@800&display=swap" rel="stylesheet"></head><body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;"><img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="160" style="display:block;"></td></tr><tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);"><h1 style="font-family:'Manrope',Arial,sans-serif;font-weight:800;margin:0 0 8px;font-size:36px;color:#111111;text-align:left;line-height:1.1;letter-spacing:-0.04em;">Votre rapport</h1><p style="margin:0 0 8px;font-size:14px;color:#747878;text-align:left;">${orgName}</p><p style="margin:0 0 40px;font-size:13px;color:#a1a1aa;text-align:left;">${periodLabelShort} &middot; ${periodLabel}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;"><tr><td style="padding:8px;"><div style="background-color:#f5f3f2;border-radius:16px;padding:20px;text-align:center;"><div style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:24px;color:#111111;letter-spacing:-0.04em;">${fmtCur(totalCA)}</div><div style="font-size:12px;color:#747878;margin-top:4px;">CA G&#233;n&#233;r&#233;</div></div></td><td style="padding:8px;"><div style="background-color:#f5f3f2;border-radius:16px;padding:20px;text-align:center;"><div style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:24px;color:#111111;letter-spacing:-0.04em;">${wonLeads.length}</div><div style="font-size:12px;color:#747878;margin-top:4px;">Ventes</div></div></td><td style="padding:8px;"><div style="background-color:#f5f3f2;border-radius:16px;padding:20px;text-align:center;"><div style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:24px;color:#111111;letter-spacing:-0.04em;">${fmtPct(closingRate)}</div><div style="font-size:12px;color:#747878;margin-top:4px;">Taux de closing</div></div></td></tr><tr><td style="padding:8px;"><div style="background-color:#f5f3f2;border-radius:16px;padding:20px;text-align:center;"><div style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:24px;color:#111111;letter-spacing:-0.04em;">${prospects.length}</div><div style="font-size:12px;color:#747878;margin-top:4px;">Total Leads</div></div></td><td style="padding:8px;"><div style="background-color:#f5f3f2;border-radius:16px;padding:20px;text-align:center;"><div style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:24px;color:#111111;letter-spacing:-0.04em;">${doneAppts}/${appointments.length}</div><div style="font-size:12px;color:#747878;margin-top:4px;">RDV effectu&#233;s</div></div></td><td style="padding:8px;"><div style="background-color:#f5f3f2;border-radius:16px;padding:20px;text-align:center;"><div style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:24px;color:#111111;letter-spacing:-0.04em;">${noshowLeads.length}</div><div style="font-size:12px;color:#747878;margin-top:4px;">No-show</div></div></td></tr></table><div style="background-color:#f5f3f2;border-radius:24px;padding:20px;margin-top:40px;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="width:32px;vertical-align:top;"><div style="font-size:20px;line-height:1;">&#128206;</div></td><td><p style="margin:0;font-size:13px;color:#1b1c1b;">Votre rapport <strong>${formatList}</strong> est joint &#224; cet email (${periodLabelShort}).</p></td></tr></table></div></td></tr><tr><td style="padding-top:48px;text-align:left;padding-left:24px;"><p style="margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">&copy; 2026 CloseOS - Tous droits r&#233;serv&#233;s</p></td></tr></table></td></tr></table></body></html>`;

    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'accept': 'application/json', 'api-key': brevoApiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'CloseOS', email: 'support@closeos.fr' },
        to: [{ email: owner.email, name: owner.full_name || 'Owner' }],
        subject: `Rapport ${periodLabelShort} — ${orgName}`,
        htmlContent,
        attachment: attachments,
      }),
    });

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('[send-report] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
