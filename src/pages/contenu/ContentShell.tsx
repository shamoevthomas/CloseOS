/**
 * Gabarit commun des pages éditoriales (glossaire, ressources, guides).
 *
 * DA Business : fond #f4f2f1, noir #111111, Manrope, cartes blanches bordées stone-200,
 * nav en pilule flottante, et doodles line-art posés en décor (src/components/doodles).
 *
 * Le contenu vient de content/*.md ; la structure et le SEO sont ici.
 *
 * ⚠️ Logo : ces pages sont transverses aux trois produits (le glossaire sert Sales,
 * Business et Sign). Poser le logo Business laisserait croire qu'elles appartiennent à
 * un seul produit, d'où le mot-symbole texte. À remplacer par une image si un logo
 * d'écosystème sur fond clair est produit un jour.
 */

import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import {
  DoodleSquiggle, DoodleSparkle, DoodleStar5, DoodleBubble, DoodleCircle,
  DoodleDashes, DoodleArrowDown, DoodleZigzag,
} from '../../components/doodles'

const SITE = 'https://www.closeos.fr'

type Meta = {
  title: string
  description: string
  path: string
  /** Une collection sous le seuil de publication ne doit pas être indexée. */
  indexable: boolean
  jsonLd?: Record<string, unknown>[]
}

/** Pose titre, description, canonique, robots et JSON-LD. Nettoie au démontage. */
export function useContentSeo({ title, description, path, indexable, jsonLd }: Meta) {
  useEffect(() => {
    const url = `${SITE}${path}`
    document.title = title
    document.querySelector('meta[name="description"]')?.setAttribute('content', description)
    document.getElementById('canonical')?.setAttribute('href', url)
    document.getElementById('og-url')?.setAttribute('content', url)
    document.getElementById('og-title')?.setAttribute('content', title)
    document.getElementById('og-description')?.setAttribute('content', description)
    document.getElementById('tw-url')?.setAttribute('content', url)
    document.getElementById('tw-title')?.setAttribute('content', title)
    document.getElementById('tw-description')?.setAttribute('content', description)

    let robots = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null
    if (!robots) {
      robots = document.createElement('meta')
      robots.name = 'robots'
      document.head.appendChild(robots)
    }
    robots.content = indexable ? 'index, follow' : 'noindex, follow'

    document.querySelectorAll('script[data-contenu-ld]').forEach((el) => el.remove())
    for (const data of jsonLd ?? []) {
      const el = document.createElement('script')
      el.type = 'application/ld+json'
      el.setAttribute('data-contenu-ld', 'true')
      el.textContent = JSON.stringify(data)
      document.head.appendChild(el)
    }

    return () => {
      document.querySelectorAll('script[data-contenu-ld]').forEach((el) => el.remove())
      robots?.setAttribute('content', 'index, follow')
    }
  }, [title, description, path, indexable, jsonLd])
}

/** Décor de fond. Purement ornemental : masqué sur mobile, hors flux, hors lecture d'écran. */
export function PageDoodles() {
  return (
    <div className="pointer-events-none absolute inset-0 hidden overflow-hidden lg:block" aria-hidden="true">
      <DoodleBubble className="absolute left-6 top-[16%] w-14 -rotate-6 text-neutral-800/25 xl:left-[7%]" />
      <DoodleSparkle className="absolute left-16 top-[9%] w-6 text-emerald-500/70 xl:left-[12%]" />
      <DoodleStar5 className="absolute right-16 top-[11%] w-5 text-amber-500/80 xl:right-[12%]" />
      <DoodleCircle className="absolute right-4 top-[24%] w-28 rotate-6 text-neutral-800/12 xl:right-[5%]" />
      <DoodleDashes className="absolute left-10 top-[46%] w-16 text-neutral-800/20 xl:left-[9%]" />
      <DoodleArrowDown className="absolute right-10 top-[38%] w-8 text-neutral-800/20 xl:right-[9%]" />
      <DoodleZigzag className="absolute left-6 top-[68%] w-16 text-[#8a43e1]/30 xl:left-[7%]" />
    </div>
  )
}

/** Titre avec un mot souligné au trait ondulé — signature de la DA Business. */
export function DoodleTitle({ children, squiggle }: { children: ReactNode; squiggle?: string }) {
  return (
    <h1
      className="text-[2.6rem] font-extrabold leading-[1.05] tracking-[-0.03em] text-[#111111] sm:text-[3.4rem]"
      style={{ fontFamily: 'Manrope, sans-serif' }}
    >
      {children}
      {children && squiggle ? ' ' : null}
      {squiggle && (
        <span className="relative inline-block">
          {squiggle}
          <DoodleSquiggle className="absolute -bottom-2 left-0 w-full text-amber-400" />
        </span>
      )}
    </h1>
  )
}

export function ContentShell({
  breadcrumb,
  children,
}: {
  breadcrumb?: { label: string; to: string }
  children: ReactNode
}) {
  return (
    <div
      className="relative min-h-screen bg-[#f4f2f1] text-[#111111] selection:bg-black/10"
      style={{ fontFamily: 'Manrope, sans-serif' }}
    >
      <nav className="sticky top-0 z-50 px-4 pt-4 md:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between rounded-2xl border border-stone-200/60 bg-white/85 px-5 py-3 shadow-sm backdrop-blur-md">
          <Link to="/" className="text-lg font-extrabold tracking-[-0.03em] text-[#111111]">
            Close<span className="text-stone-400">OS</span>
          </Link>
          <div className="hidden items-center gap-7 text-sm font-medium text-stone-600 md:flex">
            <Link to="/sales" className="transition-colors hover:text-[#111111]">Sales</Link>
            <Link to="/business" className="transition-colors hover:text-[#111111]">Business</Link>
            <Link to="/glossaire" className="transition-colors hover:text-[#111111]">Glossaire</Link>
            <Link to="/comparatifs" className="transition-colors hover:text-[#111111]">Comparatifs</Link>
            <Link to="/tarifs" className="transition-colors hover:text-[#111111]">Tarifs</Link>
          </div>
          <Link
            to="/tarifs"
            className="flex h-10 items-center justify-center rounded-lg bg-[#111111] px-5 text-sm font-semibold tracking-wide text-white transition-all hover:opacity-90"
          >
            Essai gratuit
          </Link>
        </div>
      </nav>

      <PageDoodles />

      <main className="relative z-10 mx-auto max-w-3xl px-6 pb-24 pt-16">
        <div>
          {breadcrumb && (
            <Link
              to={breadcrumb.to}
              className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition-colors hover:text-[#111111]"
            >
              <ArrowLeft className="h-4 w-4" /> {breadcrumb.label}
            </Link>
          )}
          {children}
        </div>
      </main>

      <footer className="border-t border-stone-200 bg-[#f4f2f1] px-6 py-8 md:px-20">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 text-xs font-medium text-stone-500 md:flex-row">
          <span className="text-sm font-extrabold tracking-[-0.03em] text-[#111111]">
            Close<span className="text-stone-400">OS</span>
          </span>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/glossaire" className="transition-colors hover:text-stone-700">Glossaire</Link>
            <span className="hidden sm:inline">&middot;</span>
            <Link to="/comparatifs" className="transition-colors hover:text-stone-700">Comparatifs</Link>
            <span className="hidden sm:inline">&middot;</span>
            <Link to="/tarifs" className="transition-colors hover:text-stone-700">Tarifs</Link>
            <span className="hidden sm:inline">&middot;</span>
            <Link to="/mentions-legales" className="transition-colors hover:text-stone-700">Mentions légales</Link>
            <span className="hidden sm:inline">&middot;</span>
            <Link to="/confidentialite" className="transition-colors hover:text-stone-700">Confidentialité</Link>
            <span className="hidden sm:inline">&middot;</span>
            <a
              href="https://www.linkedin.com/company/111659961/"
              target="_blank"
              rel="noopener"
              className="transition-colors hover:text-stone-700"
            >
              LinkedIn
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

/** Carte blanche bordée — le motif de bloc de la DA Business. */
export const CARD =
  'rounded-2xl border border-stone-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,.04)] transition-all hover:border-stone-300 hover:shadow-[0_4px_16px_rgba(0,0,0,.06)]'

/** Bouton noir plein, CTA principal de la DA Business. */
export const BTN_PRIMARY =
  'inline-flex h-11 items-center justify-center rounded-lg bg-[#111111] px-5 text-sm font-semibold tracking-wide text-white transition-all hover:opacity-90'

/** Bouton secondaire, contour stone. */
export const BTN_GHOST =
  'inline-flex h-11 items-center justify-center rounded-lg border border-stone-300 bg-white px-5 text-sm font-semibold tracking-wide text-[#111111] transition-colors hover:bg-stone-50'

/** Styles du markdown rendu. Le lien souligné à l'ambre est la signature éditoriale. */
export const PROSE_CLASS = 'contenu-prose'

export const PROSE_STYLES = `
  .contenu-prose h2 { color:#111111; font-size:1.6rem; font-weight:800; letter-spacing:-.02em; margin:2.6rem 0 .8rem; }
  .contenu-prose h3 { color:#111111; font-size:1.2rem; font-weight:700; margin:1.8rem 0 .5rem; }
  .contenu-prose p { color:#57534e; line-height:1.85; margin:1rem 0; font-size:1.03rem; }
  .contenu-prose strong { color:#111111; font-weight:700; }
  .contenu-prose a { color:#111111; font-weight:600; text-decoration:underline; text-decoration-color:#fbbf24; text-decoration-thickness:2px; text-underline-offset:3px; }
  .contenu-prose a:hover { text-decoration-color:#111111; }
  .contenu-prose ul,.contenu-prose ol { color:#57534e; margin:1rem 0; padding-left:1.4rem; line-height:1.85; }
  .contenu-prose ul { list-style:disc; }
  .contenu-prose ol { list-style:decimal; }
  .contenu-prose li { margin:.35rem 0; }
  .contenu-prose table { width:100%; border-collapse:collapse; margin:1.4rem 0; font-size:.94rem; display:block; overflow-x:auto; }
  .contenu-prose th,.contenu-prose td { border:1px solid #e7e5e4; padding:.65rem .85rem; text-align:left; color:#57534e; }
  .contenu-prose th { color:#111111; background:#faf9f8; font-weight:700; }
  .contenu-prose blockquote { border-left:3px solid #fbbf24; padding-left:1.1rem; margin:1.4rem 0; color:#44403c; font-style:italic; }
  .contenu-prose code { background:#f4f2f1; border:1px solid #e7e5e4; padding:.12rem .4rem; border-radius:.3rem; font-size:.9em; color:#111111; }
`
