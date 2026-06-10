/**
 * Thèmes de contrat (DA reproductibles). Un même HTML structuré + une feuille de
 * style par thème (scopée .sign-doc.theme-xxx). Le bouton "Ajouter un article"
 * insère un bloc .art balisé → la DA se reproduit.
 */

export type ThemeId = 'blank' | 'da1' | 'da2' | 'da3' | 'da4' | 'da5';

export const THEMES: { id: Exclude<ThemeId, 'blank'>; name: string; accent: string }[] = [
  { id: 'da1', name: 'Classique notarial', accent: '#1f2d4d' },
  { id: 'da2', name: 'Moderne minimal', accent: '#12a594' },
  { id: 'da3', name: 'Tech SaaS', accent: '#5b5bef' },
  { id: 'da4', name: 'Premium éditorial', accent: '#b08a4f' },
  { id: 'da5', name: 'Bold contemporain', accent: '#e8501f' },
];

const ARTICLES: { t: string; b: string }[] = [
  { t: 'Objet du contrat', b: "Le présent contrat définit les conditions dans lesquelles le Prestataire réalise, en qualité d'indépendant, la prestation suivante : ______________________________ . Le détail des livrables figure en annexe." },
  { t: 'Durée et délais', b: 'La prestation débute le ______________ et se déroule selon le calendrier convenu. Les délais courent à compter de la réception de tous les éléments nécessaires fournis par le Client.' },
  { t: 'Prix et paiement', b: 'Le prix est fixé à ____________ € HT. Un acompte de ______ % est versé à la signature, le solde à la livraison. Tout retard de paiement entraîne, après mise en demeure, des pénalités au taux légal.' },
  { t: 'Propriété intellectuelle', b: 'Les droits sur les livrables sont cédés au Client après paiement intégral. Le Prestataire conserve ses outils, méthodes et savoir-faire préexistants.' },
  { t: 'Confidentialité & RGPD', b: "Chaque Partie garde confidentielles les informations de l'autre. Les données personnelles sont traitées conformément au RGPD, pour les seules finalités du présent contrat." },
  { t: 'Résiliation & litiges', b: "En cas de manquement grave non réparé sous ______ jours après mise en demeure, l'autre Partie peut résilier de plein droit. Le contrat est régi par le droit français ; à défaut d'accord amiable, le tribunal compétent est saisi." },
];

export function newArticleHtml(n: number): string {
  return `<div class="art"><h2 class="art-h"><span class="num">${n}</span><span class="ttl">Nouvel article</span></h2><p class="art-b">Décrivez ici le contenu de l'article…</p></div>`;
}

const articlesHtml = ARTICLES.map(
  (a, i) => `<div class="art"><h2 class="art-h"><span class="num">${i + 1}</span><span class="ttl">${a.t}</span></h2><p class="art-b">${a.b}</p></div>`,
).join('');

/** HTML structuré commun à tous les thèmes (seul le CSS change). */
export const CONTRACT_TEMPLATE_HTML = `
<div class="doc-head">
  <h1 class="doc-title">Contrat de prestation de services</h1>
  <p class="doc-sub">Convention de prestation entre un prestataire indépendant et son client</p>
</div>
<div class="parties">
  <div class="party">
    <div class="party-h">Le prestataire</div>
    <p>Nom / Dénomination : ______________________</p>
    <p>SIRET : ______________________</p>
    <p>Adresse : ______________________</p>
    <p>Email : ______________________</p>
  </div>
  <div class="party">
    <div class="party-h">Le client</div>
    <p>Nom / Dénomination : ______________________</p>
    <p>SIRET : ______________________</p>
    <p>Adresse : ______________________</p>
    <p>Email : ______________________</p>
  </div>
</div>
${articlesHtml}
<div class="sig">
  <p>Fait à ________________ , le ______________ .</p>
  <div class="sig-row"><div>Le Prestataire</div><div>Le Client</div></div>
</div>`;

/** CSS de tous les thèmes (scopé par .sign-doc.theme-xxx). */
export const THEME_CSS = `
/* ---- Base structure (thèmes) ---- */
.sign-doc[class*="theme-"] .doc-head{margin-bottom:18px}
.sign-doc[class*="theme-"] .doc-sub{margin:.25rem 0 0}
.sign-doc[class*="theme-"] .parties{display:flex;gap:28px;margin:18px 0 22px}
.sign-doc[class*="theme-"] .party{flex:1;min-width:0}
.sign-doc[class*="theme-"] .party p{margin:3px 0;font-size:.92em}
.sign-doc[class*="theme-"] .art{margin:14px 0}
.sign-doc[class*="theme-"] .art-h{display:flex;align-items:baseline;gap:10px;margin:0 0 5px}
.sign-doc[class*="theme-"] .art-b{margin:0}
.sign-doc[class*="theme-"] .sig{margin-top:34px}
.sign-doc[class*="theme-"] .sig-row{display:flex;gap:28px;margin-top:30px}
.sign-doc[class*="theme-"] .sig-row>div{flex:1;border-top:1px solid #b9b9b9;padding-top:6px;font-weight:600}

/* ============ DA1 — Classique notarial ============ */
.sign-doc.theme-da1{font-family:Georgia,'Times New Roman',serif;color:#1d1d1d;text-align:justify}
.sign-doc.theme-da1 .doc-head{text-align:center}
.sign-doc.theme-da1 .doc-title{font-size:1.9rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#1f2d4d;text-align:center;margin:0}
.sign-doc.theme-da1 .doc-sub{font-style:italic;color:#555;text-align:center}
.sign-doc.theme-da1 .doc-head::after{content:"";display:block;width:120px;height:0;border-top:3px double #1f2d4d;margin:10px auto 0}
.sign-doc.theme-da1 .party-h{font-weight:700;color:#1f2d4d;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
.sign-doc.theme-da1 .art-h{font-size:1.02rem;font-weight:700;color:#1f2d4d;text-transform:uppercase;letter-spacing:.4px}
.sign-doc.theme-da1 .art .num::before{content:"Article "}
.sign-doc.theme-da1 .art .num::after{content:" — "}

/* ============ DA2 — Moderne minimal ============ */
.sign-doc.theme-da2{font-family:'Helvetica Neue',Arial,sans-serif;color:#2b2b2b}
.sign-doc.theme-da2 .doc-title{font-size:2.4rem;font-weight:300;line-height:1.1;margin:0;color:#222}
.sign-doc.theme-da2 .doc-sub{color:#9aa0a6;font-size:.95rem}
.sign-doc.theme-da2 .party-h{color:#12a594;font-weight:700;text-transform:uppercase;letter-spacing:1px;font-size:.78rem;margin-bottom:6px}
.sign-doc.theme-da2 .art-h{align-items:flex-start;flex-direction:row;gap:14px}
.sign-doc.theme-da2 .art .num{font-size:1.9rem;font-weight:300;color:#cfd4da;line-height:1;min-width:34px}
.sign-doc.theme-da2 .art .ttl{font-size:1.05rem;font-weight:700;color:#222;align-self:center}
.sign-doc.theme-da2 .art-b{padding-left:48px;color:#444}

/* ============ DA3 — Tech SaaS ============ */
.sign-doc.theme-da3{font-family:'Helvetica Neue',Arial,sans-serif;color:#2a2a33}
.sign-doc.theme-da3 .doc-title{font-size:2rem;font-weight:800;color:#1c1c28;margin:0}
.sign-doc.theme-da3 .doc-sub{color:#8a8f98}
.sign-doc.theme-da3 .doc-head::after{content:"";display:block;width:70px;height:4px;border-radius:2px;background:#5b5bef;margin-top:10px}
.sign-doc.theme-da3 .parties{gap:18px}
.sign-doc.theme-da3 .party{background:#f5f6fb;border-radius:12px;padding:16px 18px}
.sign-doc.theme-da3 .party-h{color:#5b5bef;font-weight:700;text-transform:uppercase;letter-spacing:.6px;font-size:.8rem;margin-bottom:8px}
/* Pastille + titre alignés via vertical-align (et NON flex align-items, mal géré par html2canvas → PDF décalé) */
.sign-doc.theme-da3 .art .num{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:6px;background:#5b5bef;color:#fff;font-size:.8rem;font-weight:700;flex:0 0 auto;vertical-align:middle;margin-right:10px}
.sign-doc.theme-da3 .art .ttl{font-size:1.05rem;font-weight:700;color:#1c1c28;vertical-align:middle}
.sign-doc.theme-da3 .art-h{display:block;line-height:1.3}

/* ============ DA4 — Premium éditorial ============ */
.sign-doc.theme-da4{font-family:Georgia,'Times New Roman',serif;color:#2a2a2a;text-align:justify}
.sign-doc.theme-da4 .doc-head{text-align:center}
.sign-doc.theme-da4 .doc-title{font-size:2.2rem;font-weight:400;color:#1a1a1a;margin:0;text-align:center}
.sign-doc.theme-da4 .doc-sub{text-transform:uppercase;letter-spacing:2px;font-size:.72rem;color:#b08a4f;text-align:center;font-family:Arial,sans-serif}
.sign-doc.theme-da4 .doc-head::after{content:"";display:block;width:90px;height:0;border-top:2px solid #b08a4f;margin:12px auto 0}
.sign-doc.theme-da4 .party-h{font-variant:small-caps;font-weight:700;color:#1a1a1a;letter-spacing:.5px;margin-bottom:4px}
.sign-doc.theme-da4 .art-h{display:block}
.sign-doc.theme-da4 .art .num{display:block;font-family:Arial,sans-serif;font-size:.68rem;text-transform:uppercase;letter-spacing:1.5px;color:#9a9a9a;margin-bottom:2px}
.sign-doc.theme-da4 .art .num::before{content:"Article "}
.sign-doc.theme-da4 .art .ttl{display:block;font-size:1.2rem;color:#b08a4f;font-weight:400}

/* ============ DA5 — Bold contemporain ============ */
.sign-doc.theme-da5{font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a1a}
.sign-doc.theme-da5 .doc-title{font-size:2.6rem;font-weight:800;text-transform:uppercase;line-height:.98;margin:0;color:#111}
.sign-doc.theme-da5 .doc-sub{text-transform:uppercase;letter-spacing:.5px;font-size:.72rem;color:#888;margin-top:6px}
.sign-doc.theme-da5 .parties{background:#f2f2f2;border-radius:8px;padding:18px 20px}
.sign-doc.theme-da5 .party-h{font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#111;margin-bottom:6px}
/* Pastille + titre alignés via vertical-align (et NON flex align-items, mal géré par html2canvas → PDF décalé) */
.sign-doc.theme-da5 .art .num{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;background:#e8501f;color:#fff;font-size:.85rem;font-weight:800;flex:0 0 auto;vertical-align:middle;margin-right:10px}
.sign-doc.theme-da5 .art .ttl{font-size:1.05rem;font-weight:800;text-transform:uppercase;letter-spacing:.4px;color:#111;vertical-align:middle}
.sign-doc.theme-da5 .art-h{display:block;line-height:1.3}
`;
