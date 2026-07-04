import type { VercelRequest, VercelResponse } from '@vercel/node'
import { PDFDocument } from 'pdf-lib'
// Sonde : si CETTE fonction renvoie 500, l'import de pdf-lib crashe au chargement.
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ ok: true, probe: 'pdf-lib', type: typeof PDFDocument })
}
