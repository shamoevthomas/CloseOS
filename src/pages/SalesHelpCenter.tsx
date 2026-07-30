import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Search, X, ArrowRight, GitBranch, Bell, Calendar, Headphones, BarChart3,
  Receipt, Settings, Users, LifeBuoy, Mail, ChevronRight,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import {
  DoodleSquiggle, DoodleBubble, DoodleFace, DoodleSparkle, DoodleStar5, DoodlePlane,
  DoodleRocket, DoodleCheck, DoodleBolt, DoodleHeart, DoodleTarget, DoodleBulb,
  DoodleZigzag, DoodleBurst,
} from '../components/doodles'

/* ─────────────────────────────────────────────────────────────
   Centre d'Aide CloseOS Sales (closer indépendant).
   - Barre de recherche (titres + mots-clés + contenu).
   - « Par où commencer » adapté au rôle (Closer / Setter / Setter-Closer).
   - Catégories d'articles couvrant toute l'app, filtrées selon le rôle.
   DA Sales : blanc / slate + accent sky, compatible dark mode.
   ───────────────────────────────────────────────────────────── */

type Role = 'closer' | 'setter' | 'setter-closer'
type Step = { title: string; body: string }
type Article = { id: string; title: string; keywords: string; body: string[] }
type Category = { id: string; label: string; icon: any; articles: Article[] }

const CAT_ACCENTS: { C: any; color: string }[] = [
  { C: DoodleTarget, color: 'text-sky-500 -rotate-6' },
  { C: DoodleBolt, color: 'text-sky-500' },
  { C: DoodleStar5, color: 'text-sky-500' },
  { C: DoodleBulb, color: 'text-slate-400 dark:text-neutral-500' },
  { C: DoodleHeart, color: 'text-sky-500' },
  { C: DoodleSparkle, color: 'text-sky-500' },
  { C: DoodleZigzag, color: 'text-slate-300 dark:text-neutral-600' },
  { C: DoodleBurst, color: 'text-sky-500' },
  { C: DoodleCheck, color: 'text-sky-500' },
  { C: DoodleFace, color: 'text-slate-400 dark:text-neutral-500 rotate-6' },
]

export default function SalesHelpCenter() {
  const { lang } = useLanguage()
  const { role: authRole } = useAuth()
  const fr = lang !== 'en'
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  // ─── Rôle (Closer par défaut) + prévisualisation ?role= ───
  const derivedRole: Role =
    authRole === 'Setter' ? 'setter' : authRole === 'Setter-Closer' ? 'setter-closer' : 'closer'
  const [searchParams] = useSearchParams()
  const previewRole = searchParams.get('role')
  const role: Role = (previewRole === 'setter' || previewRole === 'closer' || previewRole === 'setter-closer') ? previewRole : derivedRole
  const roleLabels: Record<Role, string> = { closer: 'Closer', setter: 'Setter', 'setter-closer': 'Setter-Closer' }
  const roleLabel = roleLabels[role]

  const startSteps: Step[] = useMemo(() => memberStartSteps(fr, role), [fr, role])
  const categories: Category[] = useMemo(() => buildCategories(fr, role), [fr, role])

  // ─── Recherche ───
  const q = query.trim().toLowerCase()
  const results = useMemo(() => {
    if (!q) return null
    const hits: { cat: Category; art: Article }[] = []
    for (const cat of categories) {
      for (const art of cat.articles) {
        const hay = (art.title + ' ' + art.keywords + ' ' + art.body.join(' ')).toLowerCase()
        if (hay.includes(q)) hits.push({ cat, art })
      }
    }
    return hits
  }, [q, categories])

  const ArticleRow = ({ art }: { art: Article }) => {
    const open = openId === art.id
    return (
      <div className={`group rounded-2xl border bg-white dark:bg-white/[0.03] overflow-hidden transition-all ${open ? 'border-sky-400/50 shadow-[0_4px_24px_-8px_rgba(14,165,233,0.28)]' : 'border-slate-200 dark:border-white/10 hover:border-sky-300 dark:hover:border-sky-500/30 hover:shadow-sm'}`}>
        <button onClick={() => setOpenId(open ? null : art.id)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left">
          <span className="font-bold text-slate-900 dark:text-white" style={{ fontFamily: "'Manrope', sans-serif" }}>{art.title}</span>
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all ${open ? 'bg-sky-500 text-white rotate-90' : 'bg-slate-100 dark:bg-white/10 text-slate-400 group-hover:text-sky-500'}`}>
            <ChevronRight className="h-4 w-4" />
          </span>
        </button>
        {open && (
          <div className="px-5 pb-5 space-y-2.5 border-t border-slate-100 dark:border-white/10 pt-4">
            {art.body.map((p, i) => (
              <p key={i} className="text-sm text-slate-600 dark:text-neutral-300 leading-relaxed">{p}</p>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative max-w-4xl mx-auto px-4 pb-24">
      {/* Halo décoratif */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-8 h-72 bg-gradient-to-b from-sky-500/[0.07] to-transparent blur-2xl" />

      {/* Doodles hero */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-64 hidden md:block">
        <DoodleBubble className="absolute left-[0%] top-[34%] w-12 text-slate-400/70 dark:text-neutral-500 -rotate-6" />
        <DoodleSparkle className="absolute left-[13%] top-[6%] w-6 text-sky-500" />
        <DoodleZigzag className="absolute left-[5%] top-[70%] w-12 text-slate-300 dark:text-neutral-600" />
        <DoodleStar5 className="absolute right-[13%] top-[6%] w-5 text-sky-500" />
        <DoodleFace className="absolute right-[0%] top-[34%] w-12 text-slate-400/70 dark:text-neutral-500 rotate-6" />
        <DoodlePlane className="absolute right-[5%] top-[70%] w-16 text-sky-500 rotate-3" />
      </div>

      {/* Header */}
      <div className="relative text-center pt-6 pb-8">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-sky-600 text-white shadow-lg shadow-sky-500/25">
          <LifeBuoy className="h-8 w-8" strokeWidth={1.5} />
        </div>
        <h1 className="relative inline-block text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.03em' }}>
          {fr ? "Centre d'aide" : 'Help center'}
          <DoodleSquiggle className="pointer-events-none absolute left-1/2 -translate-x-1/2 -bottom-3 w-40 md:w-52 text-sky-500" aria-hidden="true" />
        </h1>
        <p className="text-slate-500 dark:text-neutral-400 mt-5 text-lg max-w-xl mx-auto">{fr ? 'Tout pour tirer le meilleur de CloseOS, expliqué simplement.' : 'Everything to get the most out of CloseOS, explained simply.'}</p>
      </div>

      {/* Barre de recherche */}
      <div className="relative mb-12 max-w-2xl mx-auto">
        <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={fr ? 'Rechercher un sujet (relance, booking, Call Room, factures…)' : 'Search a topic (follow-up, booking, Call Room, invoices…)'}
          className="w-full rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 py-4 pr-12 text-base text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-4 focus:ring-sky-500/15 focus:border-sky-500 focus:outline-none shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)]"
          style={{ paddingLeft: '3.25rem' }}
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-700 transition-colors">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Résultats de recherche */}
      {results !== null ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-neutral-400 mb-3">
            {results.length === 0
              ? (fr ? `Aucun résultat pour « ${query} ». Essayez un autre mot, ou contactez le support ci-dessous.` : `No result for "${query}".`)
              : (fr ? `${results.length} résultat${results.length > 1 ? 's' : ''}` : `${results.length} result${results.length > 1 ? 's' : ''}`)}
          </p>
          {results.map(({ cat, art }) => (
            <div key={art.id}>
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">{cat.label}</span>
              <div className="mt-1"><ArticleRow art={art} /></div>
            </div>
          ))}
          {results.length === 0 && <SupportCard fr={fr} />}
        </div>
      ) : (
        <>
          {/* Par où commencer */}
          <section className="relative mb-14 overflow-hidden rounded-3xl border border-sky-500/20 bg-gradient-to-br from-sky-500/[0.07] via-sky-50/40 to-transparent dark:from-sky-900/20 dark:via-sky-900/5 dark:to-transparent p-6 sm:p-9">
            <DoodleRocket aria-hidden className="pointer-events-none absolute -right-2 -top-2 w-24 text-sky-500/50 rotate-12 hidden sm:block" />
            <DoodleStar5 aria-hidden className="pointer-events-none absolute right-[22%] top-6 w-4 text-sky-500 hidden sm:block" />
            <DoodleBurst aria-hidden className="pointer-events-none absolute right-8 bottom-6 w-6 text-sky-500/70 hidden sm:block" />

            <div className="relative">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                {fr ? 'Le plus important' : 'Start here'}
              </span>
              <h2 className="mt-3 text-3xl font-extrabold text-slate-900 dark:text-white" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.02em' }}>{fr ? 'Par où commencer' : 'Getting started'}</h2>
              <p className="text-sm text-slate-500 dark:text-neutral-400 mt-2 mb-8 max-w-lg">
                {fr ? 'Voici par où commencer, adapté à votre rôle ' : 'Here is where to start, tailored to your '}
                <span className="font-bold text-sky-600 dark:text-sky-400">{roleLabel}</span>.
              </p>

              <ol className="relative space-y-2.5">
                <span aria-hidden className="pointer-events-none absolute left-4 top-3 bottom-3 w-px bg-sky-500/20" />
                {startSteps.map((s, i) => (
                  <li key={i} className="relative flex gap-4 rounded-2xl bg-white/70 dark:bg-white/[0.04] backdrop-blur-sm border border-white/60 dark:border-white/10 p-3.5 hover:border-sky-400/30 transition-colors">
                    <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white text-sm font-extrabold ring-4 ring-white dark:ring-[#141211]">{i + 1}</span>
                    <div className="pt-0.5">
                      <p className="font-bold text-slate-900 dark:text-white" style={{ fontFamily: "'Manrope', sans-serif" }}>{s.title}</p>
                      <p className="text-sm text-slate-600 dark:text-neutral-300 leading-relaxed mt-0.5">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* Catégories */}
          <div className="space-y-12">
            {categories.map((cat, ci) => {
              const Accent = CAT_ACCENTS[ci % CAT_ACCENTS.length]
              return (
                <section key={cat.id} className="relative">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/10 to-sky-400/10 text-sky-600 dark:text-sky-400 ring-1 ring-sky-500/10">
                      <cat.icon className="h-5 w-5" strokeWidth={1.5} />
                    </div>
                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white" style={{ fontFamily: "'Manrope', sans-serif" }}>{cat.label}</h2>
                    <span className="h-px flex-1 bg-gradient-to-r from-slate-200 dark:from-white/10 to-transparent" />
                    <Accent.C aria-hidden className={`pointer-events-none w-6 shrink-0 ${Accent.color} hidden sm:block`} />
                  </div>
                  <div className="space-y-2.5">
                    {cat.articles.map((art) => <ArticleRow key={art.id} art={art} />)}
                  </div>
                </section>
              )
            })}
          </div>

          <div className="mt-14"><SupportCard fr={fr} /></div>
        </>
      )}
    </div>
  )
}

function SupportCard({ fr }: { fr: boolean }) {
  return (
    <a href="mailto:support@closeos.fr" className="group relative flex items-center justify-between gap-4 overflow-hidden rounded-3xl border border-sky-500/20 bg-gradient-to-br from-sky-500/[0.06] to-transparent dark:from-sky-900/15 p-6 hover:shadow-[0_10px_40px_-15px_rgba(14,165,233,0.4)] hover:border-sky-400/40 transition-all">
      <DoodleBubble aria-hidden className="pointer-events-none absolute -right-3 -bottom-3 w-20 text-sky-500/20 rotate-6" />
      <DoodleSparkle aria-hidden className="pointer-events-none absolute right-16 top-4 w-4 text-sky-500/60 hidden sm:block" />
      <div className="relative flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-sky-600 text-white shadow-md shadow-sky-500/20"><Mail className="h-6 w-6" strokeWidth={1.5} /></div>
        <div>
          <h4 className="font-extrabold text-slate-900 dark:text-white text-lg" style={{ fontFamily: "'Manrope', sans-serif" }}>{fr ? 'Une question sans réponse ?' : 'Still stuck?'}</h4>
          <p className="text-sm text-slate-500 dark:text-neutral-400">{fr ? "Écrivez-nous à support@closeos.fr, réponse sous 24h ouvrées." : 'Email support@closeos.fr — reply within 24 business hours.'}</p>
        </div>
      </div>
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white dark:bg-white/10 text-sky-600 dark:text-sky-400 shadow-sm group-hover:translate-x-0.5 transition-transform">
        <ArrowRight className="h-5 w-5" />
      </span>
    </a>
  )
}

/* ─────────────────────────────────────────────────────────────
   « Par où commencer » selon le rôle (Closer / Setter / Setter-Closer).
   ───────────────────────────────────────────────────────────── */
function memberStartSteps(fr: boolean, role: Role): Step[] {
  const isS = role === 'setter' || role === 'setter-closer'
  const isC = role === 'closer' || role === 'setter-closer'

  const steps: Step[] = [
    { title: fr ? 'Complétez votre profil' : 'Complete your profile', body: fr ? "Paramètres → Profil : photo, fuseau horaire, mot de passe. Activez la double authentification et, si vous voulez, associez votre compte Google pour vous connecter en un clic." : 'Settings → Profile: photo, timezone, password. Enable 2FA and optionally link your Google account.' },
    { title: fr ? 'Créez vos offres' : 'Create your offers', body: fr ? "Page « Offres » : ajoutez ce que vous vendez (prix, commissions, paiement comptant ou en plusieurs fois). C'est la base de votre pipeline, de vos factures et de vos KPIs." : 'Offers page: add what you sell (price, commissions, one-time or installments). This powers your pipeline, invoices and KPIs.' },
    { title: fr ? 'Connectez votre agenda & vos disponibilités' : 'Connect your calendar & availability', body: fr ? "Page « Rendez-vous » : connectez votre agenda (Cal.com / Google Calendar), réglez vos disponibilités et créez vos liens de booking à partager à vos prospects." : 'Appointments page: connect your calendar (Cal.com / Google Calendar), set your availability and create booking links to share with prospects.' },
  ]

  if (isS) {
    steps.push(
      { title: fr ? 'Travaillez vos leads & vos relances' : 'Work your leads & follow-ups', body: fr ? "Pipeline : contactez vos leads, faites avancer les cartes et prenez des notes. Sur l'étape « Contacté », suivez vos relances automatiques (« Relance faite »), cliquez « Répondu » quand un lead répond, et ouvrez la liste « À relancer & à suivre »." : 'Pipeline: contact your leads, move cards forward and take notes. On the "Contacted" stage, track your automatic follow-ups ("Follow-up done"), click "Replied" when a lead answers, and open the "To follow up & track" list.' },
      { title: fr ? 'Prenez vos rendez-vous' : 'Book your appointments', body: fr ? "Depuis la fiche prospect ou vos liens de booking, calez vos RDV : ils remontent automatiquement dans le pipeline et dans votre agenda." : 'From the prospect card or your booking links, schedule your appointments: they flow automatically into the pipeline and your calendar.' },
    )
  }
  if (isC) {
    steps.push(
      { title: fr ? 'Menez vos appels avec la Call Room' : 'Run your calls in the Call Room', body: fr ? "Page « Appels » : ouvrez la Call Room (script, pitch de l'offre, ressources, prise de notes et enregistrement) pour mener vos closings, puis retrouvez le compte-rendu de chaque appel." : 'Calls page: open the Call Room (script, offer pitch, resources, notes and recording) to run your closings, then find the summary of each call.' },
      { title: fr ? 'Closez et facturez' : 'Close and invoice', body: fr ? "Passez la carte en « Gagné », encaissez via Stripe (comptant ou paiement échelonné) et générez vos factures. Votre CA et vos KPIs se mettent à jour automatiquement." : 'Move the card to "Won", collect via Stripe (one-time or installments) and generate your invoices. Your revenue and KPIs update automatically.' },
    )
  }

  const kpiBody = role === 'setter-closer'
    ? (fr ? "Pages « KPI Setter » et « KPI Closer » : de la prise de contact au closing. Et l'AI Coach analyse vos appels pour vous aider à progresser." : '"Setter KPI" and "Closer KPI" pages: from first contact to closing. And the AI Coach reviews your calls to help you improve.')
    : isS
      ? (fr ? "Page « KPI Setter » : contactés, taux de réponse, taux de booking. L'AI Coach vous aide à progresser." : '"Setter KPI" page: contacted, response rate, booking rate. The AI Coach helps you improve.')
      : (fr ? "Page « KPI Closer » : taux de closing, CA, no-show. Et l'AI Coach analyse vos appels pour progresser." : '"Closer KPI" page: closing rate, revenue, no-show. And the AI Coach reviews your calls to help you improve.')
  steps.push({ title: fr ? 'Suivez vos KPIs & votre Coach IA' : 'Track your KPIs & your AI Coach', body: kpiBody })

  return steps
}

/* Catégories d'articles, filtrées selon le rôle. */
function buildCategories(fr: boolean, role: Role): Category[] {
  const isS = role === 'setter' || role === 'setter-closer'
  const isC = role === 'closer' || role === 'setter-closer'
  const cats: Category[] = []

  // Pipeline & Contacts
  const pipe: Article[] = [
    { id: 's-card', title: fr ? 'La fiche prospect' : 'The prospect card', keywords: 'fiche prospect notes tags rappel historique paiement acompte',
      body: [fr ? "Cliquez une carte pour ouvrir la fiche : coordonnées, notes d'appel, tags, rappels, historique et informations de paiement. Glissez-déposez la carte pour la faire avancer d'une étape." : 'Click a card to open its detail: contact info, call notes, tags, reminders, history and payment info. Drag it to move it forward a stage.'] },
  ]
  if (isC) pipe.push(
    { id: 's-callroom', title: fr ? "La salle d'appel (Call Room)" : 'The Call Room', keywords: 'call room salle appel script pitch notes enregistrement',
      body: [fr ? "« Ouvrir le Call Room » depuis la fiche : un cockpit plein écran avec votre script, le pitch de l'offre, les ressources, la prise de notes et l'enregistrement de l'appel." : '"Open the Call Room" from the card: a full-screen cockpit with script, offer pitch, resources, notes and call recording.'] },
  )
  pipe.push(
    { id: 's-search', title: fr ? 'Rechercher & filtrer' : 'Search & filter', keywords: 'recherche filtre croix période étape offre tag',
      body: [fr ? "La barre de recherche trouve par nom, email ou téléphone (la croix la vide). Les filtres trient par période, étape, offre et tags." : 'Search by name, email or phone (the cross clears it). Filters sort by period, stage, offer and tags.'] },
    { id: 's-contacts', title: fr ? 'Votre répertoire de contacts' : 'Your contacts directory', keywords: 'contacts répertoire annuaire',
      body: [fr ? "Page « Contacts » : votre répertoire centralisé. Retrouvez, recherchez et rouvrez n'importe quel prospect ou client, avec tout son historique." : 'Contacts page: your central directory. Find, search and reopen any prospect or client, with their full history.'] },
  )
  cats.push({ id: 'pipeline', label: fr ? 'Pipeline & Contacts' : 'Pipeline & Contacts', icon: GitBranch, articles: pipe })

  // Relances & suivi de discussion
  cats.push({
    id: 'relances', label: fr ? 'Relances & suivi de discussion' : 'Follow-ups & discussion tracking', icon: Bell,
    articles: [
      { id: 's-relance', title: fr ? 'Vos relances automatiques' : 'Your automatic follow-ups', keywords: 'relance contacté délai relance faite digest',
        body: [fr ? "Réglez vos délais de relance une fois, sur l'étape « Contacté ». CloseOS enchaîne les relances : chaque jour, vous recevez la liste de vos relances du jour ; un bouton « Relance faite » passe à la suivante." : 'Set your follow-up intervals once, on the "Contacted" stage. CloseOS chains the reminders: every day you get your due follow-ups; a "Follow-up done" button moves to the next.'] },
      { id: 's-repondu', title: fr ? 'Bouton « Répondu » & suivi de discussion' : '"Replied" button & discussion tracking', keywords: 'répondu réponse discussion qualifié disqualifié taux de réponse',
        body: [fr ? "Sur un prospect « Contacté », cliquez « Répondu » quand il vous répond : les relances se mettent en pause et le prospect bascule en suivi de discussion." : 'On a "Contacted" prospect, click "Replied" when they answer: follow-ups pause and the prospect moves into discussion tracking.', fr ? "Le lendemain, la fiche demande si la discussion continue : « Non » relance les relances ; « Oui » propose Qualifié / Disqualifié / Encore inconnu." : 'The next day, the card asks if the discussion continues: "No" resumes follow-ups; "Yes" offers Qualified / Disqualified / Still unknown.'] },
      { id: 's-worklist', title: fr ? 'Liste « À relancer & à suivre »' : '"To follow up & track" list', keywords: 'liste relancer suivre worklist',
        body: [fr ? "Le bouton « Relances » (avec compteur) en haut du pipeline ouvre votre liste : qui relancer (relance due) et qui a répondu (à qualifier)." : 'The "Follow-ups" button (with counter) at the top of the pipeline opens your list: who to chase (due) and who replied (to qualify).'] },
    ],
  })

  // Rendez-vous & Booking
  cats.push({
    id: 'rdv', label: fr ? 'Rendez-vous & Booking' : 'Appointments & Booking', icon: Calendar,
    articles: [
      { id: 's-rdv-links', title: fr ? 'Vos liens de booking' : 'Your booking links', keywords: 'booking lien rendez-vous cal.com type créneau',
        body: [fr ? "Page « Rendez-vous » : créez un type de RDV (durée, disponibilités) via Cal.com et partagez le lien. Le prospect réserve, le RDV remonte dans votre pipeline et votre agenda." : 'Appointments page: create a booking type (duration, availability) via Cal.com and share the link. The prospect books, the appointment lands in your pipeline and calendar.'] },
      { id: 's-rdv-gcal', title: fr ? 'Synchroniser votre agenda' : 'Sync your calendar', keywords: 'cal.com google calendar agenda synchronisation conflit fuseau',
        body: [fr ? "Connectez Cal.com et Google Calendar : vos disponibilités tiennent compte de vos événements, et les fuseaux horaires du prospect sont gérés automatiquement." : 'Connect Cal.com and Google Calendar: your availability accounts for your events, and the prospect timezone is handled automatically.'] },
      { id: 's-rdv-manage', title: fr ? 'Confirmer, reprogrammer, no-show' : 'Confirm, reschedule, no-show', keywords: 'confirmer reprogrammer no-show annuler meet',
        body: [fr ? "Sur chaque rendez-vous : confirmez, reprogrammez ou traitez les no-show. Un lien de visio et des rappels automatiques sont générés." : 'On each appointment: confirm, reschedule or handle no-shows. A video link and automatic reminders are generated.'] },
    ],
  })

  // Appels & téléphonie (closer / setter-closer)
  if (isC) {
    cats.push({
      id: 'appels', label: fr ? 'Appels & téléphonie' : 'Calls & telephony', icon: Headphones,
      articles: [
        { id: 's-appels', title: fr ? "Call Room & compte-rendu d'appel" : 'Call Room & call summary', keywords: 'appels call room compte-rendu enregistrement notes',
          body: [fr ? "Page « Appels » : lancez la Call Room pour mener vos closings, puis retrouvez chaque appel avec son enregistrement, ses notes et son compte-rendu." : 'Calls page: launch the Call Room to run your closings, then find each call with its recording, notes and summary.'] },
        { id: 's-telephony', title: fr ? 'Téléphonie intégrée' : 'Built-in telephony', keywords: 'téléphonie telephony appel numéro composer',
          body: [fr ? "Page « Téléphonie » : passez vos appels directement depuis CloseOS, rattachés à la bonne fiche prospect." : 'Telephony page: make your calls directly from CloseOS, attached to the right prospect card.'] },
      ],
    })
  }

  // Offres & Facturation
  cats.push({
    id: 'billing', label: fr ? 'Offres & Facturation' : 'Offers & Billing', icon: Receipt,
    articles: [
      { id: 's-offers', title: fr ? 'Vos offres' : 'Your offers', keywords: 'offres prix commission comptant échelonné',
        body: [fr ? "Page « Offres » : créez et gérez tout ce que vous vendez (prix, commissions, comptant ou paiement en plusieurs fois). Vos offres alimentent le pipeline, les factures et les KPIs." : 'Offers page: create and manage everything you sell (price, commissions, one-time or installments). Your offers power the pipeline, invoices and KPIs.'] },
      { id: 's-invoices', title: fr ? 'Encaisser & facturer' : 'Collect & invoice', keywords: 'facture stripe encaisser paiement comptant échelonné acompte pdf',
        body: [fr ? "Sur un prospect gagné, encaissez via Stripe (comptant, acompte ou paiement échelonné). Page « Factures » : générez et exportez vos factures en PDF." : 'On a won prospect, collect via Stripe (one-time, deposit or installments). Invoices page: generate and export your invoices as PDF.'] },
    ],
  })

  // KPIs & Coach IA
  const kpi: Article[] = []
  if (isS) kpi.push({ id: 's-kpi-setter', title: fr ? 'KPI Setter' : 'Setter KPI', keywords: 'kpi setter taux de réponse booking contacté',
    body: [fr ? "Page « KPI Setter » : contactés, taux de réponse (compte les « Répondu » et les prospects avancés), taux de booking, historique par offre." : '"Setter KPI" page: contacted, response rate, booking rate, per-offer history.'] })
  if (isC) kpi.push({ id: 's-kpi-closer', title: fr ? 'KPI Closer' : 'Closer KPI', keywords: 'kpi closer closing ca no-show',
    body: [fr ? "Page « KPI Closer » : taux de closing, CA, no-show, closing après R2, avec évolution vs période précédente." : '"Closer KPI" page: closing rate, revenue, no-show, closing after R2, with trend vs previous period.'] })
  kpi.push({ id: 's-coach', title: fr ? 'Coach IA' : 'AI Coach', keywords: 'ai coach ia analyse appel progression conseils',
    body: [fr ? "Page « AI Coach » : votre coaching intelligent. Il analyse vos appels et vos performances pour vous donner des conseils concrets et vous aider à progresser." : '"AI Coach" page: your intelligent coaching. It reviews your calls and performance to give you concrete advice and help you improve.'] })
  cats.push({ id: 'kpi', label: fr ? 'KPIs & Coach IA' : 'KPIs & AI Coach', icon: BarChart3, articles: kpi })

  // Compte & Paramètres
  cats.push({
    id: 'account', label: fr ? 'Compte & Paramètres' : 'Account & Settings', icon: Settings,
    articles: [
      { id: 's-security', title: fr ? 'Sécurité, 2FA & connexion Google' : 'Security, 2FA & Google login', keywords: 'sécurité mot de passe 2fa google appareil',
        body: [fr ? "Paramètres → Sécurité : mot de passe, double authentification, et association de votre compte Google pour une connexion en un clic." : 'Settings → Security: password, two-factor authentication, and Google account linking for one-click login.'] },
      { id: 's-interface', title: fr ? 'Interface, profil & abonnement' : 'Interface, profile & subscription', keywords: 'interface thème sombre profil photo fuseau abonnement parrainage',
        body: [fr ? "Paramètres : personnalisez votre profil (photo, fuseau horaire) et le thème (clair / sombre), et gérez votre abonnement et votre parrainage." : 'Settings: customize your profile (photo, timezone) and theme (light / dark), and manage your subscription and referral.'] },
    ],
  })

  return cats
}
