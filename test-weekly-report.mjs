import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import fs from 'fs';

function fmtCur(v) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}
function fmtPct(v) { return `${v.toFixed(1)}%`; }

const C = {
  black: [17, 17, 17], gray: [116, 120, 120], lightGray: [196, 199, 199],
  bg: [245, 243, 242], bgAlt: [251, 249, 248], line: [240, 238, 236],
  green: [0, 108, 73], red: [186, 26, 26], amber: [255, 185, 95],
  dark: [27, 28, 27], darkGray: [68, 71, 72], white: [255, 255, 255],
};

const STAGE_COLORS = {
  prospect: C.green, qualified: C.amber, unqualified: C.lightGray,
  followup: C.dark, won: C.green, lost: C.red, noanswer: C.gray, noshow: C.darkGray,
};
const STAGE_LABELS = {
  prospect: 'Nouveau Lead', qualified: 'Qualifié', unqualified: 'Non-Qualifié',
  followup: 'Follow Up', won: 'Gagné', lost: 'Perdu', noanswer: 'Pas de Réponse', noshow: 'No Show',
};
const LOSS_COLORS = [[99,102,241],[245,158,11],[139,92,246],[100,116,139],[239,68,68],[249,115,22],[161,161,170]];

const d = {
  orgName: 'CloseOS Business', weekLabel: '17 mars — 24 mars 2026', ownerName: 'Thomas',
  totalLeads: 24, wonCount: 8, lostCount: 3, noshowCount: 2,
  qualifiedCount: 6, followupCount: 5, activeCount: 15,
  totalCA: 18500, avgDeal: 2312.5, closingRate: 61.5, noshowRate: 12.5, lostRate: 23.1,
  totalPipeline: 42000, commission: 1850,
  totalAppts: 15, doneAppts: 12, pendingAppts: 1, confirmedAppts: 1, cancelledAppts: 1, showUpRate: 80, cancelRate: 6.7,
  stageData: [
    { stage: 'prospect', count: 5, pct: 21 }, { stage: 'qualified', count: 6, pct: 25 },
    { stage: 'followup', count: 5, pct: 21 }, { stage: 'won', count: 8, pct: 33 },
    { stage: 'lost', count: 3, pct: 13 }, { stage: 'noshow', count: 2, pct: 8 },
  ],
  lossData: [
    { reason: 'Argent/budget', count: 2, pct: 67 },
    { reason: 'Je dois y réfléchir', count: 1, pct: 33 },
  ],
  campStats: [
    { name: 'Formation Closing Pro', active: true, date: '2026-01-15', views: 342, leads: 10, won: 4, ca: 9200, conv: 2.9, commission: 920 },
    { name: 'Coaching Business', active: true, date: '2026-02-01', views: 218, leads: 8, won: 3, ca: 6800, conv: 3.7, commission: 680 },
    { name: 'Masterclass Vente', active: false, date: '2026-02-20', views: 156, leads: 6, won: 1, ca: 2500, conv: 3.8, commission: 250 },
  ],
  memberStats: [
    { name: 'Lucas Martin', role: 'Closer', leads: 8, wins: 4, ca: 9200, setterLeads: 0, setterBooked: 0 },
    { name: 'Emma Dubois', role: 'Closer', leads: 6, wins: 3, ca: 6800, setterLeads: 0, setterBooked: 0 },
    { name: 'Thomas Petit', role: 'Setter', leads: 0, wins: 0, ca: 0, setterLeads: 12, setterBooked: 9 },
    { name: 'Julie Bernard', role: 'Setter-Closer', leads: 4, wins: 1, ca: 2500, setterLeads: 6, setterBooked: 4 },
  ],
  caPerCamp: [
    { name: 'Formation Closing Pro', ca: 9200 },
    { name: 'Coaching Business', ca: 6800 },
    { name: 'Masterclass Vente', ca: 2500 },
  ],
};

// ─── BUILD PDF ───
function buildPDF() {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const m = 18;
  const cw = W - m * 2;
  let y = 16;

  const checkPage = (need) => { if (y + need > H - 15) { doc.addPage(); y = 16; } };
  const sectionTitle = (title) => { checkPage(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...C.black); doc.text(title, m, y); y += 8; };
  const drawBar = (x, yy, w, h, color, maxW, val, maxVal) => {
    doc.setFillColor(...C.line); doc.roundedRect(x, yy, maxW, h, 1.5, 1.5, 'F');
    const bw = maxVal > 0 ? Math.max((val / maxVal) * maxW, 2) : 2;
    doc.setFillColor(...color); doc.roundedRect(x, yy, bw, h, 1.5, 1.5, 'F');
  };

  // HEADER
  doc.setFillColor(17, 17, 17);
  doc.roundedRect(m, y, cw, 28, 4, 4, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(...C.white);
  doc.text('CloseOS', m + 12, y + 12);
  doc.setFontSize(9); doc.setTextColor(200, 200, 200);
  doc.text('Rapport Hebdomadaire', m + 12, y + 19);
  doc.setTextColor(...C.white); doc.setFontSize(10);
  doc.text(d.orgName, W - m - 12, y + 12, { align: 'right' });
  doc.setFontSize(8); doc.setTextColor(200, 200, 200);
  doc.text(d.weekLabel, W - m - 12, y + 19, { align: 'right' });
  y += 36;

  // KPIs PRINCIPAUX
  sectionTitle('KPIs Principaux');
  const mainKpis = [
    { label: "CA Généré", value: fmtCur(d.totalCA) },
    { label: "Ventes", value: String(d.wonCount), sub: `${fmtCur(d.avgDeal)} moy.` },
    { label: "Taux de Closing", value: fmtPct(d.closingRate) },
    { label: "Commission estimée", value: fmtCur(d.commission) },
  ];
  const cardW = (cw - 9) / 4;
  mainKpis.forEach((kpi, i) => {
    const x = m + i * (cardW + 3);
    doc.setFillColor(...C.bg); doc.roundedRect(x, y, cardW, 22, 3, 3, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...C.black);
    doc.text(kpi.value, x + cardW / 2, y + 10, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...C.gray);
    doc.text(kpi.label.toUpperCase(), x + cardW / 2, y + 16, { align: 'center' });
    if (kpi.sub) { doc.setFontSize(5.5); doc.text(kpi.sub, x + cardW / 2, y + 20, { align: 'center' }); }
  });
  y += 28;

  // KPIs SECONDAIRES
  const secKpis = [
    { label: "Total Leads", value: String(d.totalLeads) },
    { label: "Show Up", value: String(d.doneAppts) },
    { label: "No Show", value: String(d.noshowCount), color: C.red },
    { label: "Taux de perte", value: fmtPct(d.lostRate) },
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
  const halfW = cw / 2 - 4;
  const stageMax = Math.max(...d.stageData.map(s => s.count), 1);
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
    const barColors = [C.green, C.dark, C.amber, C.gray, C.lightGray];
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
      startY: y, margin: { left: m, right: m },
      head: [['Campagne', 'Statut', 'Vues', 'Conv.', 'Leads', 'Gagnés', 'CA', 'Comm.']],
      body: [
        ...d.campStats.map(c => [c.name, c.active ? 'Active' : 'Paused', String(c.views), fmtPct(c.conv), String(c.leads), String(c.won), fmtCur(c.ca), fmtCur(c.commission)]),
        ['Total', '', String(d.campStats.reduce((s, c) => s + c.views, 0)), '', String(d.campStats.reduce((s, c) => s + c.leads, 0)), String(d.campStats.reduce((s, c) => s + c.won, 0)), fmtCur(d.totalCA), fmtCur(d.commission)],
      ],
      styles: { font: 'helvetica', fontSize: 7, cellPadding: 2.5 },
      headStyles: { fillColor: C.bg, textColor: C.gray, fontStyle: 'bold', fontSize: 6.5 },
      bodyStyles: { textColor: C.dark },
      columnStyles: { 0: { cellWidth: 'auto', fontStyle: 'bold' }, 1: { cellWidth: 16, halign: 'center' }, 2: { cellWidth: 16, halign: 'center' }, 3: { cellWidth: 14, halign: 'center' }, 4: { cellWidth: 14, halign: 'center' }, 5: { cellWidth: 14, halign: 'center' }, 6: { cellWidth: 22, halign: 'right', fontStyle: 'bold' }, 7: { cellWidth: 22, halign: 'right' } },
      alternateRowStyles: { fillColor: C.bgAlt },
      didParseCell: (data) => { if (data.row.index === d.campStats.length) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.fillColor = C.bg; } },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // PERFORMANCE ÉQUIPE
  if (d.memberStats.length > 0) {
    checkPage(30);
    sectionTitle("Performance de l'Équipe");
    autoTable(doc, {
      startY: y, margin: { left: m, right: m },
      head: [['Membre', 'Rôle', 'Leads', 'Gagnés', 'CA', 'Leads settés', 'RDV bookés']],
      body: d.memberStats.map(mb => [mb.name, mb.role, String(mb.leads), String(mb.wins), fmtCur(mb.ca), String(mb.setterLeads), String(mb.setterBooked)]),
      styles: { font: 'helvetica', fontSize: 7, cellPadding: 2.5 },
      headStyles: { fillColor: C.bg, textColor: C.gray, fontStyle: 'bold', fontSize: 6.5 },
      bodyStyles: { textColor: C.dark },
      columnStyles: { 0: { cellWidth: 'auto', fontStyle: 'bold' }, 1: { cellWidth: 24 }, 2: { halign: 'center', cellWidth: 14 }, 3: { halign: 'center', cellWidth: 14 }, 4: { halign: 'right', cellWidth: 22, fontStyle: 'bold' }, 5: { halign: 'center', cellWidth: 20 }, 6: { halign: 'center', cellWidth: 20 } },
      alternateRowStyles: { fillColor: C.bgAlt },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // RÉSUMÉ FINANCIER + RDV
  checkPage(50);
  sectionTitle('Résumé Financier & Rendez-vous');
  const boxW = (cw - 6) / 2;
  doc.setFillColor(17, 17, 17); doc.roundedRect(m, y, boxW, 38, 3, 3, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...C.white);
  doc.text('Résumé Financier', m + 8, y + 8);
  [['Taux de Closing', fmtPct(d.closingRate)], ['Panier Moyen', fmtCur(d.avgDeal)], ['Show Up Rate', fmtPct(d.showUpRate)], ['Valeur Pipeline', fmtCur(d.totalPipeline)]].forEach((item, i) => {
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
  [['Total RDV', String(d.totalAppts)], ['Terminés', String(d.doneAppts)], ['En attente', String(d.pendingAppts)], ['Confirmés', String(d.confirmedAppts)], ['Annulés', String(d.cancelledAppts)]].forEach((item, i) => {
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
  doc.setFillColor(...C.line); doc.roundedRect(m, barY, cw, 5, 2, 2, 'F');
  let barX = m;
  d.stageData.forEach((s, i) => {
    if (s.count === 0 || d.totalLeads === 0) return;
    const w = (s.count / d.totalLeads) * cw;
    const color = STAGE_COLORS[s.stage] || C.gray;
    doc.setFillColor(...color);
    if (i === 0) doc.roundedRect(barX, barY, w, 5, 2, 2, 'F');
    else doc.rect(barX, barY, w, 5, 'F');
    barX += w;
  });
  y += 13;
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

  // FOOTER
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(180, 180, 180);
    doc.text('CloseOS — Rapport hebdomadaire généré automatiquement', m, H - 8);
    doc.text(`Page ${p}/${totalPages}`, W - m, H - 8, { align: 'right' });
  }

  return doc.output('datauristring').split(',')[1];
}

// ─── BUILD CSV ───
function buildCSV() {
  const sep = ';';
  const lines = [];
  const row = (...cols) => lines.push(cols.map(c => `"${String(c).replace(/"/g, '""')}"`).join(sep));

  row('Rapport Hebdomadaire', d.orgName, d.weekLabel);
  lines.push('');
  row('KPIs Principaux');
  row('Métrique', 'Valeur');
  row("CA Généré", fmtCur(d.totalCA));
  row("Ventes", d.wonCount);
  row("Panier Moyen", fmtCur(d.avgDeal));
  row("Taux de Closing", fmtPct(d.closingRate));
  row("Commission estimée", fmtCur(d.commission));
  lines.push('');
  row('KPIs Secondaires');
  row('Métrique', 'Valeur');
  row("Total Leads", d.totalLeads);
  row("Show Up", d.doneAppts);
  row("No Show", d.noshowCount);
  row("Taux de perte", fmtPct(d.lostRate));
  row("Taux de no-show", fmtPct(d.noshowRate));
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

const pdfBase64 = buildPDF();
const csvBase64 = buildCSV();

// Read env
const envFile = fs.readFileSync('/Users/thomasshamoev/closeros-mvp/.env.production.local', 'utf-8');
const brevoMatch = envFile.match(/BREVO_API_KEY="?([^"\n]+)"?/);
const BREVO_KEY = brevoMatch ? brevoMatch[1].trim() : '';

console.log('PDF size:', Math.round(pdfBase64.length / 1024), 'KB');
console.log('CSV size:', Math.round(csvBase64.length / 1024), 'KB');
console.log('Sending email...');

const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
  method: 'POST',
  headers: { 'accept': 'application/json', 'api-key': BREVO_KEY, 'content-type': 'application/json' },
  body: JSON.stringify({
    sender: { name: 'CloseOS', email: 'support@closeos.fr' },
    to: [{ email: 'tekatubois@gmail.com', name: 'Thomas' }],
    subject: 'Rapport hebdomadaire — CloseOS Business — 17 mars — 24 mars 2026',
    htmlContent: `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Manrope:wght@800&display=swap" rel="stylesheet"><style>.manrope{font-family:'Manrope',Arial,sans-serif!important;font-weight:800!important;letter-spacing:-0.04em!important}.inter{font-family:'Inter',Helvetica,sans-serif!important;line-height:1.6!important}.gradient-text{background:linear-gradient(135deg,#ff4b72 0%,#a03cf8 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;color:#a03cf8}</style></head><body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;"><div class="manrope" style="font-size:28px;color:#111111;">Close<span class="gradient-text">OS</span></div></td></tr><tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);"><h1 class="manrope" style="margin:0 0 8px;font-size:36px;color:#111111;text-align:left;line-height:1.1;">Rapport<br>hebdomadaire</h1><p class="inter" style="margin:0 0 8px;font-size:14px;color:#747878;text-align:left;">CloseOS Business</p><p class="inter" style="margin:0 0 40px;font-size:13px;color:#a1a1aa;text-align:left;">17 mars &#8212; 24 mars 2026</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;"><tr><td style="padding:8px;"><div style="background-color:#f5f3f2;border-radius:16px;padding:20px;text-align:center;"><div style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:24px;color:#111111;letter-spacing:-0.04em;">${fmtCur(d.totalCA)}</div><div style="font-family:'Inter',Helvetica,sans-serif;font-size:12px;color:#747878;margin-top:4px;">CA G&#233;n&#233;r&#233;</div></div></td><td style="padding:8px;"><div style="background-color:#f5f3f2;border-radius:16px;padding:20px;text-align:center;"><div style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:24px;color:#111111;letter-spacing:-0.04em;">${d.wonCount}</div><div style="font-family:'Inter',Helvetica,sans-serif;font-size:12px;color:#747878;margin-top:4px;">Ventes</div></div></td><td style="padding:8px;"><div style="background-color:#f5f3f2;border-radius:16px;padding:20px;text-align:center;"><div style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:24px;color:#111111;letter-spacing:-0.04em;">${fmtPct(d.closingRate)}</div><div style="font-family:'Inter',Helvetica,sans-serif;font-size:12px;color:#747878;margin-top:4px;">Taux de closing</div></div></td></tr><tr><td style="padding:8px;"><div style="background-color:#f5f3f2;border-radius:16px;padding:20px;text-align:center;"><div style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:24px;color:#111111;letter-spacing:-0.04em;">${d.totalLeads}</div><div style="font-family:'Inter',Helvetica,sans-serif;font-size:12px;color:#747878;margin-top:4px;">Total Leads</div></div></td><td style="padding:8px;"><div style="background-color:#f5f3f2;border-radius:16px;padding:20px;text-align:center;"><div style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:24px;color:#111111;letter-spacing:-0.04em;">${d.doneAppts}/${d.totalAppts}</div><div style="font-family:'Inter',Helvetica,sans-serif;font-size:12px;color:#747878;margin-top:4px;">RDV effectu&#233;s</div></div></td><td style="padding:8px;"><div style="background-color:#f5f3f2;border-radius:16px;padding:20px;text-align:center;"><div style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:24px;color:#111111;letter-spacing:-0.04em;">${d.noshowCount}</div><div style="font-family:'Inter',Helvetica,sans-serif;font-size:12px;color:#747878;margin-top:4px;">No-show</div></div></td></tr></table><div style="text-align:center;margin-top:40px;"><a href="https://www.closeos.fr/business/report" style="display:inline-block;background-color:#111111;color:#ffffff;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:14px;padding:16px 40px;border-radius:48px;text-decoration:none;letter-spacing:-0.02em;">Voir le rapport complet</a></div><div style="background-color:#f5f3f2;border-radius:24px;padding:20px;margin-top:40px;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="width:32px;vertical-align:top;"><div style="font-size:20px;line-height:1;">&#128206;</div></td><td><p class="inter" style="margin:0;font-size:13px;color:#1b1c1b;">Le <strong>rapport PDF</strong> et le <strong>fichier CSV</strong> sont joints &#224; cet email avec le d&#233;tail des campagnes, du pipeline et de l'&#233;quipe.</p></td></tr></table></div></td></tr><tr><td style="padding-top:48px;text-align:left;padding-left:24px;"><p class="inter" style="margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">&copy; 2026 CloseOS - Tous droits r&#233;serv&#233;s</p><p class="inter" style="margin:0;font-size:12px;color:#1b1c1b;opacity:0.5;">Rapport g&#233;n&#233;r&#233; automatiquement chaque dimanche.</p></td></tr></table></td></tr></table></body></html>`,
    attachment: [
      { content: pdfBase64, name: 'CloseOS-Rapport-2026-03-24.pdf' },
      { content: csvBase64, name: 'CloseOS-Rapport-2026-03-24.csv' },
    ],
  }),
});

const result = await resp.json();
console.log('Result:', JSON.stringify(result));
