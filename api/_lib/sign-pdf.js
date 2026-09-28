// CloseOS Sign — lecture des tailles de pages d'un PDF (pdf-lib), pour l'API REST uniquement.
// Séparé de sign-service.js pour que api/mcp.js (zéro dépendance) ne charge jamais pdf-lib.

import { PDFDocument } from 'pdf-lib'

/** Taille affichée de chaque page, en points PDF, rotation comprise : [{ w, h }]. */
export async function measurePdf(bytes) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false })
  const pages = doc.getPages()
  if (!pages.length) throw new Error('aucune page')
  return pages.map((p) => {
    const { width, height } = p.getSize()
    const quarter = Math.abs(p.getRotation().angle) % 180 === 90
    const round = (v) => Math.round(v * 100) / 100
    return quarter ? { w: round(height), h: round(width) } : { w: round(width), h: round(height) }
  })
}
