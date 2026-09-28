// Page de signature (/sign/s/:token) : le shell HTML récupéré par social-meta est une page
// pré-rendue (sur sign.closeos.fr, « / » redirige vers la landing /sign). Servie telle quelle, la
// landing s'affichait jusqu'au démarrage de React. On remplace le contenu de #root par l'écran
// d'attente de la page de signature, identique à src/components/SignDocLoading.tsx.

export const SIGN_DOC_LOADING_TEXT = { fr: 'Chargement de votre document…', en: 'Loading your document…' } as const

export function signDocLoadingHtml(lang: 'fr' | 'en'): string {
  return (
    '<div data-sign-doc-loading style="position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;' +
    'background:#191E1E;color:#A1A9A9;font-family:&quot;SF Pro Display&quot;,&quot;Helvetica Neue&quot;,Helvetica,Arial,sans-serif;font-size:14px">' +
    '<div style="width:28px;height:28px;border-radius:9999px;border:3px solid #3A4242;border-top-color:#CEFF8F;animation:signDocSpin .8s linear infinite"></div>' +
    `<p style="margin:0">${SIGN_DOC_LOADING_TEXT[lang]}</p></div>`
  )
}

/** Remplace le contenu de <div id="root"> (divs imbriqués compris) ; renvoie le HTML inchangé si #root est introuvable. */
export function replaceRoot(html: string, inner: string): string {
  const open = html.indexOf('<div id="root">')
  if (open < 0) return html
  const start = open + '<div id="root">'.length
  const tag = /<\/?div\b[^>]*>/gi
  tag.lastIndex = start
  let depth = 1
  let m: RegExpExecArray | null
  while ((m = tag.exec(html))) {
    depth += m[0][1] === '/' ? -1 : 1
    if (depth === 0) return html.slice(0, start) + inner + html.slice(m.index)
  }
  return html
}

export function signDocShell(shell: string, lang: 'fr' | 'en'): string {
  const style = '<style>@keyframes signDocSpin{to{transform:rotate(360deg)}}html,body{background:#191E1E}</style>'
  return replaceRoot(shell, signDocLoadingHtml(lang)).replace('</head>', `${style}</head>`)
}
