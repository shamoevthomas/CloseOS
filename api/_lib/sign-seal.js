// CloseOS Sign — PDF signé produit par le serveur (lot 3).
// Les valeurs des champs sont dessinées SUR le PDF d'origine avec pdf-lib : le texte et les pages du
// document restent vectoriels, dans leur format réel (A4, paysage, autre). Signatures dessinées :
// SVG tracé en vectoriel ; image importée : image ; initiales tapées : texte.
// Repère des champs : pixels d'une page affichée à 794 px de large (éditeur et page signataire).

import { degrees, LineCapStyle, PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export const DISPLAY_W = 794
const INK = rgb(26 / 255, 26 / 255, 26 / 255)
const SIGNATURE_TYPES = new Set(['signature', 'initials'])
const CHECKBOX_DEFAULT_TEXT = "J'ai lu et j'accepte les conditions"

// ───────── Signatures SVG ─────────

const MAX_SVG_BYTES = 400_000
const PATH_RE = /<path\b([^>]*)\/?>/g
const attr = (s, name) => { const m = s.match(new RegExp(`\\b${name}="([^"]*)"`)); return m ? m[1] : null }

/**
 * Lit une signature SVG produite par la modale de signature : viewBox "0 0 w h" et des <path>
 * (commandes M/L/Q/C/Z uniquement). Tout autre contenu est refusé : la valeur vient du navigateur
 * du signataire, on ne dessine que des tracés.
 */
export function parseSignatureSvg(dataUrl) {
  const m = String(dataUrl).match(/^data:image\/svg\+xml(;base64)?,(.*)$/s)
  if (!m) return null
  const raw = m[1] ? Buffer.from(m[2], 'base64').toString('utf8') : decodeURIComponent(m[2])
  if (raw.length > MAX_SVG_BYTES) throw new Error('signature SVG trop volumineuse')
  if (/<(script|image|foreignObject|use|text|style)\b/i.test(raw)) throw new Error('signature SVG non conforme')
  const vb = (attr(raw, 'viewBox') || '').trim().split(/[\s,]+/).map(Number)
  if (vb.length !== 4 || vb.some((n) => !Number.isFinite(n)) || vb[2] <= 0 || vb[3] <= 0) throw new Error('signature SVG sans viewBox')
  const paths = []
  for (const pm of raw.matchAll(PATH_RE)) {
    const d = attr(pm[1], 'd') || ''
    if (!/^[MLQCZmlqcz0-9.,\s-]+$/.test(d)) throw new Error('tracé SVG non conforme')
    paths.push({ d, width: Number(attr(pm[1], 'stroke-width')) || 2.5 })
  }
  if (!paths.length || paths.length > 500) throw new Error('signature SVG vide ou trop complexe')
  return { minX: vb[0], minY: vb[1], width: vb[2], height: vb[3], paths }
}

// ───────── Texte ─────────

/** Retire les caractères que la police standard (WinAnsi) ne sait pas encoder. */
export function encodable(font, text) {
  let out = ''
  for (const ch of String(text)) {
    try { font.encodeText(ch); out += ch } catch { out += ch.trim() ? '?' : ' ' }
  }
  return out
}

function fitText(font, text, size, maxWidth) {
  let s = size
  while (s > 5 && font.widthOfTextAtSize(text, s) > maxWidth) s -= 0.5
  if (font.widthOfTextAtSize(text, s) <= maxWidth) return { text, size: s }
  let t = text
  while (t.length > 1 && font.widthOfTextAtSize(`${t}…`, s) > maxWidth) t = t.slice(0, -1)
  return { text: `${t}…`, size: s }
}

/** Date affichée comme dans l'application : AAAA-MM-JJ → JJ/MM/AAAA, sinon inchangée. */
export function formatDateFR(v) {
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v)
}
const isChecked = (v) => ['1', 'true', 'oui', 'yes', 'on', 'x', '✓'].includes(String(v).trim().toLowerCase())

// ───────── Pages ─────────

/**
 * Page prête à dessiner dans le repère affiché : une page tournée (/Rotate) est remplacée par une
 * page droite qui contient l'originale en objet vectoriel, pivotée ; les champs se posent alors
 * directement dans le sens de lecture.
 */
async function uprightPage(doc, index) {
  const page = doc.getPage(index)
  const rot = ((page.getRotation().angle % 360) + 360) % 360
  const box = page.getCropBox()
  if (rot === 0) return { page, box }
  const embedded = await doc.embedPage(page, { left: box.x, bottom: box.y, right: box.x + box.width, top: box.y + box.height })
  const quarter = rot === 90 || rot === 270
  const W = quarter ? box.height : box.width
  const H = quarter ? box.width : box.height
  const fresh = doc.insertPage(index, [W, H])
  doc.removePage(index + 1)
  const at = { 90: { x: 0, y: H }, 180: { x: W, y: H }, 270: { x: W, y: 0 } }[rot]
  fresh.drawPage(embedded, { ...at, rotate: degrees(-rot) })
  return { page: fresh, box: fresh.getCropBox() }
}

// ───────── Dessin ─────────

/**
 * Dessine les champs remplis (et les images insérées dans l'éditeur) sur le PDF d'origine.
 * fields : { field_type, page, pos_x, pos_y, width, height, value, label }
 * images : { page, x, y, w, h, src } (data URL png/jpeg)
 * Renvoie les octets du PDF scellé.
 */
export async function sealPdf(originalBytes, fields, images = []) {
  const doc = await PDFDocument.load(originalBytes, { ignoreEncryption: true, updateMetadata: false })
  const helv = await doc.embedFont(StandardFonts.Helvetica)
  const script = await doc.embedFont(StandardFonts.TimesRomanBoldItalic)
  const pageCount = doc.getPageCount()
  const prepared = new Map()
  const at = async (n) => {
    if (!prepared.has(n)) prepared.set(n, await uprightPage(doc, n - 1))
    return prepared.get(n)
  }
  // Repère affiché (px, origine en haut à gauche) → points PDF (origine en bas à gauche).
  const place = ({ box }, x, y, w, h) => {
    const k = box.width / DISPLAY_W
    return { k, x: box.x + x * k, y: box.y + box.height - (y + h) * k, w: w * k, h: h * k }
  }
  const embedRaster = async (src) => {
    const m = String(src).match(/^data:image\/(png|jpe?g);base64,(.*)$/s)
    if (!m) return null
    const bytes = Buffer.from(m[2], 'base64')
    return m[1] === 'png' ? doc.embedPng(bytes) : doc.embedJpg(bytes)
  }
  const drawContained = (page, img, r) => {
    const s = Math.min(r.w / img.width, r.h / img.height)
    page.drawImage(img, { x: r.x + (r.w - img.width * s) / 2, y: r.y + (r.h - img.height * s) / 2, width: img.width * s, height: img.height * s })
  }

  for (const im of images || []) {
    const n = Number(im.page || 1)
    if (n < 1 || n > pageCount) continue
    const img = await embedRaster(im.src)
    if (!img) continue
    const pg = await at(n)
    const r = place(pg, Number(im.x), Number(im.y), Number(im.w), Number(im.h))
    pg.page.drawImage(img, { x: r.x, y: r.y, width: r.w, height: r.h })
  }

  for (const f of fields) {
    const value = f.value == null ? '' : String(f.value)
    if (!value) continue
    const n = Number(f.page || 1)
    if (n < 1 || n > pageCount) throw new Error(`champ ${f.id || ''} sur une page inexistante (${n})`)
    const pg = await at(n)
    const page = pg.page
    const r = place(pg, Number(f.pos_x), Number(f.pos_y), Number(f.width), Number(f.height))

    if (SIGNATURE_TYPES.has(f.field_type)) {
      const svg = parseSignatureSvg(value)
      if (svg) {
        const s = Math.min(r.w / svg.width, r.h / svg.height)
        const x = r.x + (r.w - svg.width * s) / 2 - svg.minX * s
        const top = r.y + r.h - (r.h - svg.height * s) / 2 + svg.minY * s
        for (const p of svg.paths) {
          page.drawSvgPath(p.d, { x, y: top, scale: s, borderColor: INK, borderWidth: p.width * s, borderLineCap: LineCapStyle.Round })
        }
        continue
      }
      const img = await embedRaster(value)
      if (img) { drawContained(page, img, r); continue }
      if (value.startsWith('data:')) throw new Error(`signature au format non pris en charge (${value.slice(0, 30)})`)
      const t = fitText(script, encodable(script, value), r.h * 0.6, r.w)
      page.drawText(t.text, { x: r.x + (r.w - script.widthOfTextAtSize(t.text, t.size)) / 2, y: r.y + (r.h - t.size * 0.7) / 2, size: t.size, font: script, color: INK })
      continue
    }

    if (f.field_type === 'checkbox') {
      const box = Math.min(r.h * 0.55, 5 * 2.835) // 5 mm au plus, comme le PDF navigateur
      const by = r.y + (r.h - box) / 2
      page.drawRectangle({ x: r.x, y: by, width: box, height: box, borderColor: rgb(0.24, 0.24, 0.24), borderWidth: 0.85 })
      if (isChecked(value)) {
        const line = (x1, y1, x2, y2) => page.drawLine({ start: { x: r.x + box * x1, y: by + box * (1 - y1) }, end: { x: r.x + box * x2, y: by + box * (1 - y2) }, thickness: 1.4, color: INK, lineCap: LineCapStyle.Round })
        line(0.2, 0.55, 0.42, 0.82)
        line(0.42, 0.82, 0.82, 0.2)
      }
      const label = f.label && String(f.label).trim() ? String(f.label) : CHECKBOX_DEFAULT_TEXT
      const t = fitText(helv, encodable(helv, label), Math.max(8, Math.min(Number(f.height) * 0.32, 14)) * r.k, Math.max(1, r.w - box - 4))
      page.drawText(t.text, { x: r.x + box + 4, y: r.y + (r.h - t.size * 0.7) / 2, size: t.size, font: helv, color: INK })
      continue
    }

    const text = encodable(helv, f.field_type === 'date' ? formatDateFR(value) : value).replace(/\s+/g, ' ')
    const t = fitText(helv, text, Math.max(8, Math.min(Number(f.height) * 0.42, 30)) * r.k, r.w)
    page.drawText(t.text, { x: r.x + (r.w - helv.widthOfTextAtSize(t.text, t.size)) / 2, y: r.y + (r.h - t.size * 0.7) / 2, size: t.size, font: helv, color: INK })
  }

  return doc.save()
}

/** PDF final remis aux parties : document scellé suivi des pages du certificat. */
export async function mergePdfs(first, second) {
  const out = await PDFDocument.create()
  for (const bytes of [first, second]) {
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true })
    for (const p of await out.copyPages(src, src.getPageIndices())) out.addPage(p)
  }
  return out.save()
}
