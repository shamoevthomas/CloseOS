import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Search, X, ArrowRight, GitBranch, Bell, Calendar, Users, Megaphone,
  ClipboardList, BarChart3, Receipt, Settings, Bot, LifeBuoy, Mail, ChevronRight, Headphones,
} from 'lucide-react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessLang } from '../i18n/BusinessLangContext'
import {
  DoodleSquiggle, DoodleBubble, DoodleFace, DoodleSparkle, DoodleStar5, DoodlePlane,
  DoodleRocket, DoodleCheck, DoodleBolt, DoodleHeart, DoodleTarget, DoodleBulb,
  DoodleZigzag, DoodleBurst,
} from '../../components/doodles'

/* ─────────────────────────────────────────────────────────────
   Centre d'Aide CloseOS Business.
   - Barre de recherche (filtre titres + contenu + mots-clés).
   - « Par où commencer » adapté au plan (Solo / Business / +Acquisition).
   - Catégories d'articles couvrant toute l'app.
   ───────────────────────────────────────────────────────────── */

type Step = { title: string; body: string }
type Article = { id: string; title: string; keywords: string; body: string[] }
type Category = { id: string; label: string; icon: any; articles: Article[] }
type Role = 'owner' | 'hos' | 'admin' | 'setter' | 'closer' | 'setter-closer'

// Petits doodles d'accent, alternés section par section (comme la LP).
const CAT_ACCENTS: { C: any; color: string }[] = [
  { C: DoodleTarget, color: 'text-emerald-500 -rotate-6' },
  { C: DoodleBolt, color: 'text-emerald-500' },
  { C: DoodleStar5, color: 'text-emerald-500' },
  { C: DoodleBulb, color: 'text-stone-400 dark:text-neutral-500' },
  { C: DoodleHeart, color: 'text-emerald-500' },
  { C: DoodleSparkle, color: 'text-emerald-500' },
  { C: DoodleZigzag, color: 'text-stone-300 dark:text-neutral-600' },
  { C: DoodleCheck, color: 'text-emerald-500' },
  { C: DoodleBurst, color: 'text-emerald-500' },
  { C: DoodleFace, color: 'text-stone-400 dark:text-neutral-500 rotate-6' },
]

export default function BusinessHelpCenter() {
  const { lang } = useBusinessLang()
  const { isSolo, hasAcquisition, isTeamMember, teamMember } = useBusinessAuth()
  const fr = lang !== 'en'
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  // ─── Rôle de l'utilisateur ───
  const rawRole: string = isTeamMember ? (teamMember?.role || '') : 'Owner'
  const derivedRole: Role =
    !isTeamMember ? 'owner'
    : rawRole === 'Head of Sales' ? 'hos'
    : rawRole === 'Admin' ? 'admin'
    : rawRole === 'Setter' ? 'setter'
    : rawRole === 'Closer' ? 'closer'
    : rawRole === 'Setter-Closer' ? 'setter-closer'
    : 'owner'
  // Prévisualisation : ?role=setter|closer|setter-closer (ex. un owner qui veut voir l'aide d'un membre).
  const [searchParams] = useSearchParams()
  const previewRole = searchParams.get('role')
  const role: Role = (previewRole === 'setter' || previewRole === 'closer' || previewRole === 'setter-closer') ? previewRole : derivedRole
  const isManagement = role === 'owner' || role === 'hos' || role === 'admin'

  // Libellé affiché : l'offre pour le management, le rôle pour les membres.
  const planLabel = isSolo ? 'Solo' : hasAcquisition ? 'Business + Acquisition' : 'Business'
  const roleLabels: Record<Role, string> = { owner: planLabel, hos: 'Head of Sales', admin: 'Admin', setter: 'Setter', closer: 'Closer', 'setter-closer': 'Setter-Closer' }
  const audienceLabel = roleLabels[role]

  // ─── « Par où commencer » adapté au rôle (et, pour le management, au plan) ───
  const startSteps: Step[] = useMemo(() => {
    if (!isManagement) return memberStartSteps(fr, role)
    // Management (owner / head of sales / admin) — parcours de mise en place complet :
    // profil → organisation → disponibilités → formules → contrats CloseOS Sign
    // → (équipe si l'offre en a une) → (campagnes si acquisition).
    const steps: Step[] = [
      { title: fr ? 'Complétez votre profil' : 'Complete your profile', body: fr ? "Paramètres → Profil : nom, photo, fuseau horaire. Activez la double authentification et, si vous voulez, associez votre compte Google pour une connexion en un clic." : 'Settings → Profile: name, photo, timezone. Enable 2FA and optionally link your Google account.' },
      { title: fr ? 'Renseignez votre organisation' : 'Fill in your organization', body: fr ? "Page « Organisation » : complétez les informations de votre organisation (identité, ressources). Elles servent dans toute l'app, vos documents et pour votre équipe." : 'Organization page: fill in your organization info (identity, resources). It is used across the app, your documents and your team.' },
      { title: fr ? 'Définissez vos disponibilités' : 'Set your availability', body: fr ? "Page « Disponibilité » : réglez vos créneaux et posez vos absences. C'est ce qui alimente vos liens de booking et évite les conflits d'agenda." : 'Availability page: set your slots and time off. This powers your booking links and avoids calendar conflicts.' },
      { title: fr ? 'Créez vos formules' : 'Create your plans', body: fr ? "Page « Formules » : inscrivez toutes vos formules (prix, commissions, paiement comptant ou en plusieurs fois). C'est la base du pipeline, des factures et des KPIs." : 'Formulas page: add all your plans (price, commissions, one-time or installments). This powers the pipeline, invoices and KPIs.' },
      { title: fr ? 'Préparez vos contrats dans CloseOS Sign' : 'Prepare your contracts in CloseOS Sign', body: isSolo
          ? (fr ? "CloseOS Sign est inclus dans votre abonnement (même connexion) : préparez à l'avance tous vos contrats en modèles réutilisables, prêts à envoyer et faire signer (et payer) en un lien." : 'CloseOS Sign is included in your plan (same login): pre-build all your contracts as reusable templates, ready to send and get signed (and paid) in one link.')
          : (fr ? "CloseOS Sign est inclus dans votre abonnement (même connexion) : préparez tous vos contrats en modèles réutilisables et configurez l'espace closer (reps) pour que chaque membre de l'équipe envoie et fasse signer les contrats." : 'CloseOS Sign is included in your plan (same login): pre-build all your contracts as reusable templates and set up the closer (reps) space so each team member can send and get contracts signed.') },
    ]
    if (!isSolo) {
      steps.push({ title: fr ? 'Invitez votre équipe & assignez les rôles' : 'Invite your team & assign roles', body: fr ? "« Mon équipe » : invitez vos closers / setters par lien magique (valable 7 jours) et donnez à chacun son rôle (Owner, Head of Sales, Admin, Closer, Setter, Setter-Closer). Vous pourrez ensuite leur attribuer les leads et fixer des objectifs." : 'My team: invite closers/setters via magic link (7 days) and assign each a role. You can then assign them leads and set objectives.' })
    }
    if (hasAcquisition) {
      steps.push({ title: fr ? 'Préparez vos campagnes' : 'Set up your campaigns', body: fr ? "« Campagnes » : créez vos campagnes (avec RDV ou inscription seule) et leurs pages de capture (titre, vidéo, champs custom, redirection), puis générez le code embed pour votre site. Suivez ensuite vues, leads et conversions dans « Acquisition »." : 'Campaigns: create your campaigns (with booking or sign-up only) and their capture pages, then generate the embed code for your site. Track views, leads and conversions in Acquisition.' })
    }
    return steps
  }, [fr, isSolo, hasAcquisition, isManagement, role])

  // ─── Catégories & articles ───
  const categories: Category[] = useMemo(
    () => (isManagement ? buildCategories(fr, hasAcquisition, isSolo) : buildMemberCategories(fr, role)),
    [fr, hasAcquisition, isSolo, isManagement, role]
  )

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
      <div className={`group rounded-2xl border bg-white dark:bg-neutral-800/40 overflow-hidden transition-all ${open ? 'border-[#006c49]/40 shadow-[0_4px_24px_-8px_rgba(0,108,73,0.25)]' : 'border-stone-200 dark:border-neutral-700 hover:border-[#006c49]/30 hover:shadow-sm'}`}>
        <button onClick={() => setOpenId(open ? null : art.id)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left">
          <span className="font-business-display font-bold text-stone-900 dark:text-white">{art.title}</span>
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all ${open ? 'bg-[#006c49] text-white rotate-90' : 'bg-stone-100 dark:bg-neutral-700 text-stone-400 group-hover:text-[#006c49]'}`}>
            <ChevronRight className="h-4 w-4" />
          </span>
        </button>
        {open && (
          <div className="px-5 pb-5 space-y-2.5 border-t border-stone-100 dark:border-neutral-700/60 pt-4">
            {art.body.map((p, i) => (
              <p key={i} className="text-sm text-stone-600 dark:text-neutral-300 leading-relaxed">{p}</p>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative max-w-4xl mx-auto pb-24">
      {/* Halo décoratif */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-8 h-72 bg-gradient-to-b from-[#006c49]/[0.06] to-transparent blur-2xl" />

      {/* Doodles hero */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-64 hidden md:block">
        <DoodleBubble className="absolute left-[0%] top-[34%] w-12 text-stone-400/70 dark:text-neutral-500 -rotate-6" />
        <DoodleSparkle className="absolute left-[13%] top-[6%] w-6 text-emerald-500" />
        <DoodleZigzag className="absolute left-[5%] top-[70%] w-12 text-stone-300 dark:text-neutral-600" />
        <DoodleStar5 className="absolute right-[13%] top-[6%] w-5 text-emerald-500" />
        <DoodleFace className="absolute right-[0%] top-[34%] w-12 text-stone-400/70 dark:text-neutral-500 rotate-6" />
        <DoodlePlane className="absolute right-[5%] top-[70%] w-16 text-emerald-500 rotate-3" />
      </div>

      {/* Header */}
      <div className="relative text-center pt-6 pb-8">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#006c49] to-emerald-600 text-white shadow-lg shadow-emerald-600/20">
          <LifeBuoy className="h-8 w-8" strokeWidth={1.5} />
        </div>
        <h1 className="relative inline-block font-business-display text-4xl md:text-5xl font-extrabold text-stone-900 dark:text-white tracking-tight">
          {fr ? "Centre d'aide" : 'Help center'}
          <DoodleSquiggle className="pointer-events-none absolute left-1/2 -translate-x-1/2 -bottom-3 w-40 md:w-52 text-emerald-500" aria-hidden="true" />
        </h1>
        <p className="text-stone-500 dark:text-neutral-400 mt-5 text-lg max-w-xl mx-auto">{fr ? 'Tout pour tirer le meilleur de CloseOS Business, expliqué simplement.' : 'Everything to get the most out of CloseOS Business, explained simply.'}</p>
      </div>

      {/* Barre de recherche */}
      <div className="relative mb-12 max-w-2xl mx-auto">
        <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={fr ? "Rechercher un sujet (relance, booking, équipe, Stripe…)" : 'Search a topic (follow-up, booking, team, Stripe…)'}
          className="w-full rounded-full border border-stone-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 py-4 pr-12 text-base text-stone-900 dark:text-white placeholder:text-stone-400 focus:ring-4 focus:ring-[#006c49]/15 focus:border-[#006c49] focus:outline-none shadow-[0_8px_30px_-12px_rgba(0,0,0,0.15)]"
          style={{ paddingLeft: '3.25rem' }}
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-stone-400 hover:bg-stone-100 dark:hover:bg-neutral-700 hover:text-stone-700 transition-colors">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Résultats de recherche */}
      {results !== null ? (
        <div className="space-y-3">
          <p className="text-sm text-stone-500 dark:text-neutral-400 mb-3">
            {results.length === 0
              ? (fr ? `Aucun résultat pour « ${query} ». Essayez un autre mot, ou contactez le support ci-dessous.` : `No result for "${query}".`)
              : (fr ? `${results.length} résultat${results.length > 1 ? 's' : ''}` : `${results.length} result${results.length > 1 ? 's' : ''}`)}
          </p>
          {results.map(({ cat, art }) => (
            <div key={art.id}>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#006c49]">{cat.label}</span>
              <div className="mt-1"><ArticleRow art={art} /></div>
            </div>
          ))}
          {results.length === 0 && <SupportCard fr={fr} />}
        </div>
      ) : (
        <>
          {/* Par où commencer */}
          <section className="relative mb-14 overflow-hidden rounded-3xl border border-[#006c49]/20 bg-gradient-to-br from-[#006c49]/[0.06] via-emerald-50/40 to-transparent dark:from-emerald-900/20 dark:via-emerald-900/5 dark:to-transparent p-6 sm:p-9">
            <DoodleRocket aria-hidden className="pointer-events-none absolute -right-2 -top-2 w-24 text-emerald-500/50 rotate-12 hidden sm:block" />
            <DoodleStar5 aria-hidden className="pointer-events-none absolute right-[22%] top-6 w-4 text-emerald-500 hidden sm:block" />
            <DoodleBurst aria-hidden className="pointer-events-none absolute right-8 bottom-6 w-6 text-emerald-500/70 hidden sm:block" />

            <div className="relative">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#006c49] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                {fr ? 'Le plus important' : 'Start here'}
              </span>
              <h2 className="mt-3 font-business-display text-3xl font-extrabold text-stone-900 dark:text-white">{fr ? 'Par où commencer' : 'Getting started'}</h2>
              <p className="text-sm text-stone-500 dark:text-neutral-400 mt-2 mb-8 max-w-lg">
                {fr
                  ? (isManagement ? 'Suivez cette marche à suivre pour bien démarrer, adaptée à votre offre ' : "Bienvenue dans l'équipe ! Voici par où commencer, adapté à votre rôle ")
                  : (isManagement ? 'Follow this path to get started, tailored to your ' : 'Welcome to the team! Here is where to start, tailored to your ')}
                <span className="font-bold text-[#006c49]">{audienceLabel}</span>.
              </p>

              <ol className="relative space-y-2.5">
                {/* ligne verticale de liaison */}
                <span aria-hidden className="pointer-events-none absolute left-4 top-3 bottom-3 w-px bg-[#006c49]/20" />
                {startSteps.map((s, i) => (
                  <li key={i} className="relative flex gap-4 rounded-2xl bg-white/70 dark:bg-neutral-800/50 backdrop-blur-sm border border-white/60 dark:border-neutral-700/50 p-3.5 hover:border-[#006c49]/30 transition-colors">
                    <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#006c49] text-white text-sm font-extrabold ring-4 ring-white dark:ring-neutral-900">{i + 1}</span>
                    <div className="pt-0.5">
                      <p className="font-business-display font-bold text-stone-900 dark:text-white">{s.title}</p>
                      <p className="text-sm text-stone-600 dark:text-neutral-300 leading-relaxed mt-0.5">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>

              {isManagement && !hasAcquisition && (
                <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[#006c49]/20 bg-white dark:bg-neutral-800/60 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#006c49]/10 text-[#006c49]"><Megaphone className="h-5 w-5" strokeWidth={1.5} /></div>
                  <p className="text-sm text-stone-600 dark:text-neutral-300 pt-1">
                    {fr ? "Le système d'acquisition (campagnes, pages de capture, tracking) est inclus dans l'offre " : 'The acquisition system (campaigns, capture pages, tracking) is included in the '}
                    <strong>Business + Acquisition</strong>{fr ? ". Passez à cette offre depuis vos Paramètres pour l'activer." : ' plan.'}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Catégories */}
          <div className="space-y-12">
            {categories.map((cat, ci) => {
              const Accent = CAT_ACCENTS[ci % CAT_ACCENTS.length]
              return (
                <section key={cat.id} className="relative">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#006c49]/10 to-emerald-500/10 text-[#006c49] ring-1 ring-[#006c49]/10">
                      <cat.icon className="h-5 w-5" strokeWidth={1.5} />
                    </div>
                    <h2 className="font-business-display text-xl font-extrabold text-stone-900 dark:text-white">{cat.label}</h2>
                    <span className="h-px flex-1 bg-gradient-to-r from-stone-200 dark:from-neutral-700 to-transparent" />
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
    <a href="mailto:support@closeos.fr" className="group relative flex items-center justify-between gap-4 overflow-hidden rounded-3xl border border-[#006c49]/20 bg-gradient-to-br from-[#006c49]/[0.05] to-transparent dark:from-emerald-900/15 p-6 hover:shadow-[0_10px_40px_-15px_rgba(0,108,73,0.35)] hover:border-[#006c49]/40 transition-all">
      <DoodleBubble aria-hidden className="pointer-events-none absolute -right-3 -bottom-3 w-20 text-emerald-500/20 rotate-6" />
      <DoodleSparkle aria-hidden className="pointer-events-none absolute right-16 top-4 w-4 text-emerald-500/60 hidden sm:block" />
      <div className="relative flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#006c49] to-emerald-600 text-white shadow-md shadow-emerald-600/20"><Mail className="h-6 w-6" strokeWidth={1.5} /></div>
        <div>
          <h4 className="font-business-display font-extrabold text-stone-900 dark:text-white text-lg">{fr ? 'Une question sans réponse ?' : 'Still stuck?'}</h4>
          <p className="text-sm text-stone-500 dark:text-neutral-400">{fr ? "Écrivez-nous à support@closeos.fr, réponse sous 24h ouvrées." : 'Email support@closeos.fr — reply within 24 business hours.'}</p>
        </div>
      </div>
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white dark:bg-neutral-800 text-[#006c49] shadow-sm group-hover:translate-x-0.5 transition-transform">
        <ArrowRight className="h-5 w-5" />
      </span>
    </a>
  )
}

function buildCategories(fr: boolean, hasAcquisition: boolean, _isSolo: boolean): Category[] {
  const cats: Category[] = [
    {
      id: 'pipeline', label: fr ? 'Pipeline & CRM' : 'Pipeline & CRM', icon: GitBranch,
      articles: [
        { id: 'pl-stages', title: fr ? 'Personnaliser les étapes du pipeline' : 'Customize pipeline stages', keywords: 'pipeline étape stage kanban personnaliser drag',
          body: [fr ? 'Ouvrez le Pipeline et cliquez sur « Nouveau statut » pour ajouter une étape, ou l\'engrenage de configuration pour réorganiser/réinitialiser.' : 'Open the Pipeline and click "New status" to add a stage.', fr ? 'Déplacez un prospect d\'une étape à l\'autre en glisser-déposer. La valeur de l\'étape et les KPIs se recalculent automatiquement.' : 'Drag a prospect between stages.'] },
        { id: 'pl-card', title: fr ? 'La fiche prospect' : 'The prospect card', keywords: 'fiche prospect notes tags tâches historique paiement',
          body: [fr ? 'Cliquez une carte pour ouvrir la fiche : Call Room, création de rappel, booking de RDV, notes d\'appel, tags, historique et informations de paiement.' : 'Click a card to open its detail: Call Room, reminder, booking, notes, tags, history, payment.'] },
        { id: 'pl-callroom', title: fr ? 'La salle d\'appel (Call Room)' : 'The Call Room', keywords: 'call room salle appel script pitch notes enregistrement offre',
          body: [fr ? '« Ouvrir le Call Room » depuis la fiche : un cockpit plein écran avec votre script, le pitch de l\'offre, les ressources et la prise de notes — plus l\'enregistrement de l\'appel.' : '"Open the Call Room" from the card: a full-screen cockpit with script, offer pitch, resources, notes and call recording.'] },
        { id: 'pl-dup', title: fr ? 'Détecter et fusionner les doublons' : 'Detect and merge duplicates', keywords: 'doublon fusion merge email téléphone',
          body: [fr ? 'Quand des fiches partagent le même email ou téléphone, un bandeau « X doublons » apparaît (Owner / Head of Sales / Admin). Comparez côte à côte et fusionnez : les RDV, rappels, notes et tags sont conservés sur la fiche gardée.' : 'When records share an email/phone, a "X duplicates" banner appears. Compare side by side and merge.'] },
        { id: 'pl-import', title: fr ? 'Importer / exporter des prospects (CSV)' : 'Import / export prospects (CSV)', keywords: 'import export csv',
          body: [fr ? 'Depuis le pipeline, utilisez l\'import/export CSV pour charger ou récupérer vos prospects en masse. Un reformatage automatique aligne les colonnes.' : 'Use CSV import/export from the pipeline.'] },
        { id: 'pl-search', title: fr ? 'Rechercher et filtrer' : 'Search and filter', keywords: 'recherche filtre croix vider équipe offre tag',
          body: [fr ? 'La barre de recherche trouve par nom, email ou téléphone (une croix la vide). Les filtres permettent de trier par période, membre d\'équipe, étape, offre et tags.' : 'Search by name/email/phone; filter by period, member, stage, offer, tags.'] },
      ],
    },
    {
      id: 'relances', label: fr ? 'Relances & suivi de discussion' : 'Follow-ups & discussion tracking', icon: Bell,
      articles: [
        { id: 'rl-config', title: fr ? 'Configurer les relances « Contacté »' : 'Set up "Contacted" follow-ups', keywords: 'relance contacté délai intervalle email setter',
          body: [fr ? 'Sur la colonne « Contacté » du pipeline, l\'engrenage ouvre la config des relances. Les délais sont des intervalles : la 1ère relance part X jours après l\'entrée en « Contacté », chaque suivante X jours après la relance précédente.' : 'On the "Contacted" column, the gear opens the follow-up config. Delays are intervals from the previous follow-up.', fr ? 'Le commercial assigné reçoit un email digest quotidien listant ses relances du jour. Marquez « Relance faite » pour passer à la suivante (la date de la prochaine s\'affiche sur la fiche).' : 'The assigned rep gets a daily digest. Mark "Follow-up done" to move on.'] },
        { id: 'rl-repondu', title: fr ? 'Bouton « Répondu » + suivi de discussion' : '"Replied" button + discussion tracking', keywords: 'répondu réponse discussion qualifié disqualifié inconnu taux de réponse',
          body: [fr ? 'Sur la fiche d\'un prospect « Contacté », cliquez « Répondu » quand il vous répond : ça compte dans votre taux de réponse et met les relances en pause.' : 'Click "Replied" when a contacted prospect answers: it counts toward your response rate and pauses follow-ups.', fr ? 'Un jour plus tard, la fiche demande « Toujours en discussion ? » : « Non » relance les relances ; « Oui » ouvre Qualifié / Disqualifié / Encore inconnu (qui reprogramme un point le lendemain). Un digest « Toujours en discussion ? » part aussi chaque jour à 17h.' : 'One day later: "Still in discussion?" — No resumes follow-ups; Yes offers Qualified / Disqualified / Still unknown. A daily digest goes out at 5pm.'] },
        { id: 'rl-worklist', title: fr ? 'Liste « À relancer & à suivre »' : '"To follow up & track" list', keywords: 'liste relancer suivre worklist point de vue setter',
          body: [fr ? 'Le bouton « Relances » (avec compteur) en haut du pipeline ouvre votre liste : qui relancer (relance due) et qui a répondu (à qualifier).' : 'The "Follow-ups" button on the pipeline opens your worklist.', fr ? 'Owner / Head of Sales / Admin peuvent choisir le point de vue d\'un setter précis pour voir SA liste.' : 'Owner / HOS / Admin can switch the viewpoint to a specific setter.'] },
        { id: 'rl-noshow', title: fr ? 'Relances « No Show »' : '"No Show" follow-ups', keywords: 'no show absent relance email booking',
          body: [fr ? 'Sur la colonne « No Show », l\'engrenage configure jusqu\'à 7 emails de relance envoyés directement AU PROSPECT (avec un lien de réservation relié à votre CRM), pour récupérer les absents.' : 'On the "No Show" column, configure up to 7 follow-up emails sent to the prospect.'] },
      ],
    },
    {
      id: 'rdv', label: fr ? 'Rendez-vous & Booking' : 'Appointments & Booking', icon: Calendar,
      articles: [
        { id: 'rdv-links', title: fr ? 'Créer un lien de booking' : 'Create a booking link', keywords: 'booking lien rendez-vous type créneau disponibilité',
          body: [fr ? 'Page Rendez-vous → panneau « Liens de Booking » (bouton +). Créez un type de RDV (durée, disponibilités) et partagez le lien : le prospect réserve, le RDV remonte dans votre pipeline.' : 'Appointments → "Booking Links" panel (+). Create a link type and share it.'] },
        { id: 'rdv-gcal', title: fr ? 'Synchroniser Google Calendar (anti-conflit)' : 'Sync Google Calendar', keywords: 'google calendar agenda synchronisation conflit fuseau',
          body: [fr ? 'Connectez Google Calendar : vos disponibilités tiennent compte de vos événements existants, et les fuseaux horaires du prospect sont gérés automatiquement (pas de faux « créneau pris »).' : 'Connect Google Calendar for conflict-free, timezone-aware availability.'] },
        { id: 'rdv-manage', title: fr ? 'Confirmer, reprogrammer, réassigner un RDV' : 'Confirm, reschedule, reassign', keywords: 'confirmer reprogrammer réassigner annuler rdv meet',
          body: [fr ? 'Sur chaque rendez-vous : Confirmer, Reprogrammer, Réassigner (à un autre membre) ou Annuler. Un lien Google Meet et des rappels automatiques sont générés.' : 'On each appointment: Confirm, Reschedule, Reassign, Cancel — with Meet link and reminders.'] },
        { id: 'rdv-avail', title: fr ? 'Gérer ses disponibilités et absences' : 'Manage availability & time off', keywords: 'disponibilité absence horaires membre',
          body: [fr ? 'Page « Disponibilité » : définissez vos horaires et posez des absences. Chaque membre gère les siennes ; les absences passées sont grisées.' : 'Availability page: set hours and time off per member.'] },
      ],
    },
  ]

  cats.push({
    id: 'team', label: fr ? 'Équipe' : 'Team', icon: Users,
    articles: [
      { id: 'tm-invite', title: fr ? 'Inviter des membres' : 'Invite members', keywords: 'équipe invitation lien magique membre closer setter',
        body: [fr ? '« Mon équipe » → invitez par lien magique (valable 7 jours). Le membre crée son mot de passe et accède à son propre espace.' : 'My team → invite via magic link (7 days).'] },
      { id: 'tm-roles', title: fr ? 'Les 6 rôles et leurs droits' : 'The 6 roles', keywords: 'rôle owner head of sales admin closer setter setter-closer droits',
        body: [fr ? 'Owner (tout), Head of Sales & Admin (gestion élargie), Closer (ferme les deals), Setter (prend les RDV), Setter-Closer (les deux). Le pipeline, les KPIs et les menus s\'adaptent au rôle.' : 'Owner, Head of Sales, Admin, Closer, Setter, Setter-Closer — the app adapts to each role.'] },
      { id: 'tm-assign', title: fr ? 'Attribuer les leads et objectifs' : 'Assign leads & objectives', keywords: 'attribution assignation lead objectif membre',
        body: [fr ? 'Assignez un setter et/ou un closer sur chaque prospect. Fixez des objectifs par membre (menu « Objectifs ») suivis en temps réel.' : 'Assign setter/closer per prospect; set objectives per member.'] },
      { id: 'tm-macro', title: fr ? 'Vue macro Owner & KPIs par membre' : 'Owner macro view & per-member KPIs', keywords: 'macro owner kpi membre reporting monday',
        body: [fr ? 'Le tableau de bord Owner suit toute l\'équipe en temps réel. Un « Monday Morning Reporting » automatique et un rapport exportable en PDF complètent le suivi.' : 'The Owner dashboard tracks the whole team; automatic Monday reporting + PDF export.'] },
      { id: 'tm-autoassign', title: fr ? 'Attribution automatique des leads' : 'Automatic lead assignment', keywords: 'attribution automatique round robin aléatoire lead setter closer',
        body: [fr ? 'Dans le CRM, configurez la répartition automatique des nouveaux leads : round-robin, aléatoire, ou vers un/plusieurs membres précis, en visant les closers ou les setters.' : 'In the CRM, set automatic lead distribution: round-robin, random, or specific members.', fr ? 'Vous pouvez aussi respecter l\'assignation envoyée par vos intégrations (HubSpot, Pipedrive…).' : 'You can also keep the assignment sent by your integrations.'] },
      { id: 'tm-kb', title: fr ? 'Base de connaissances & onboarding équipe' : 'Knowledge base & team onboarding', keywords: 'organisation base de connaissances onboarding équipe notion pdf guides',
        body: [fr ? 'La page « Organisation » est un espace type Notion : créez des sections et des blocs (texte, liens, PDF) pour onboarder vos closers et setters. L\'Owner édite, les membres consultent.' : 'The Organization page is a Notion-like space to onboard your team (text, links, PDF). Owner edits, members read.'] },
    ],
  })

  if (hasAcquisition) {
    cats.push({
      id: 'acq', label: fr ? 'Acquisition & Campagnes' : 'Acquisition & Campaigns', icon: Megaphone,
      articles: [
        { id: 'acq-camp', title: fr ? 'Créer une campagne + page de capture' : 'Create a campaign + capture page', keywords: 'campagne acquisition page capture vidéo champs redirection',
          body: [fr ? '« Campagnes » : créez une campagne (mode « avec RDV » ou « inscription seule ») et sa page de capture (titre, vidéo, champs personnalisés, redirection).' : 'Campaigns: create a campaign and its capture page.'] },
        { id: 'acq-embed', title: fr ? 'Intégrer sur votre site (embed / popup)' : 'Embed on your website', keywords: 'embed iframe popup code site',
          body: [fr ? 'Générez le code embed (iframe ou popup bloquant) et collez-le sur votre site. Les leads capturés arrivent directement dans votre CRM.' : 'Generate embed code (iframe or blocking popup) for your site.'] },
        { id: 'acq-kpi', title: fr ? 'Suivre les KPIs & le tracking UTM' : 'Track KPIs & UTM', keywords: 'tracking utm kpi vues leads conversion source globe',
          body: [fr ? 'Page « Acquisition » : suivez vues, leads et taux de conversion par campagne, avec camembert des campagnes les plus converties et CA par campagne. Des liens de tracking UTM et un globe des visiteurs sont disponibles.' : 'Acquisition page: views, leads, conversion per campaign + UTM tracking links.'] },
      ],
    })
  }

  cats.push({
    id: 'forms', label: fr ? 'Formulaires' : 'Forms', icon: ClipboardList,
    articles: [
      { id: 'fm-editor', title: fr ? 'Créer un formulaire (éditeur « / »)' : 'Create a form', keywords: 'formulaire éditeur notion bloc slash champ',
        body: [fr ? '« Formulaires » : éditeur façon Notion — tapez « / » pour insérer un champ (texte, choix, note, date, champ caché UTM…). Idéal pour candidatures, sondages, briefs.' : 'Forms: Notion-like editor, type "/" to insert a field.'] },
      { id: 'fm-vsl', title: fr ? 'Bloc vidéo à visionnage obligatoire (VSL)' : 'Mandatory video block (VSL)', keywords: 'vidéo vsl visionnage obligatoire',
        body: [fr ? 'Ajoutez un bloc vidéo qui exige un temps de visionnage minimum avant de pouvoir valider le formulaire.' : 'Add a video block requiring minimum watch time before submitting.'] },
      { id: 'fm-crm', title: fr ? 'Pont CRM & précapture des leads' : 'CRM bridge & lead precapture', keywords: 'crm pont précapture lead prospect email téléphone',
        body: [fr ? 'Chaque réponse crée ou met à jour un prospect au bon stage. La précapture enregistre le lead dès qu\'un email/numéro est saisi, même sans avoir terminé le formulaire.' : 'Each answer creates/updates a prospect; precapture saves leads early.'] },
    ],
  })

  cats.push({
    id: 'kpi', label: fr ? 'KPIs & Objectifs' : 'KPIs & Objectives', icon: BarChart3,
    articles: [
      { id: 'kpi-setter', title: fr ? 'KPI Setter (taux de réponse, booking)' : 'Setter KPI', keywords: 'kpi setter taux de réponse booking contacté',
        body: [fr ? 'Page « KPI Setter » : contactés, taux de réponse (compte les « Répondu » et les prospects avancés), taux de booking, historique par offre.' : 'Setter KPI: contacted, response rate, booking rate, per-offer history.'] },
      { id: 'kpi-closer', title: fr ? 'KPI Closer (closing, CA, commissions)' : 'Closer KPI', keywords: 'kpi closer closing ca commission no-show',
        body: [fr ? 'Page « KPI Closer » : taux de closing, CA, commissions, no-show, closing après R2, avec évolution vs période précédente.' : 'Closer KPI: closing rate, revenue, commissions, no-show.'] },
      { id: 'kpi-obj', title: fr ? 'Objectifs et revenue' : 'Objectives & revenue', keywords: 'objectif revenue mrr stripe ca',
        body: [fr ? '« Objectifs » : cibles par membre. « Revenue » : suivi du CA réel (dont MRR via Stripe) incrémenté à chaque paiement.' : 'Objectives per member; Revenue tracks real revenue incl. MRR.'] },
    ],
  })

  cats.push({
    id: 'billing', label: fr ? 'Facturation & Paiement' : 'Billing & Payment', icon: Receipt,
    articles: [
      { id: 'bl-stripe', title: fr ? 'Connecter Stripe et encaisser' : 'Connect Stripe & get paid', keywords: 'stripe connect paiement facture mrr abonnement',
        body: [fr ? 'Connectez Stripe (Stripe Connect) pour encaisser, suivre le CA réel et le MRR. Les paiements récurrents incrémentent automatiquement le CA du closer qui a closé.' : 'Connect Stripe to collect payments and track revenue/MRR.'] },
      { id: 'bl-invoices', title: fr ? 'Factures de l\'organisation' : 'Organization invoices', keywords: 'facture commission échelonné pdf',
        body: [fr ? 'Page « Factures » : générez les factures de commissions, gérez le comptant vs paiement échelonné, et exportez en PDF.' : 'Invoices page: commission invoices, installments, PDF export.'] },
      { id: 'bl-plan', title: fr ? 'Gérer votre abonnement & extras' : 'Manage your subscription & extras', keywords: 'abonnement plan extras setup intégration paramètres',
        body: [fr ? 'Paramètres → Profil : gérez votre offre et achetez des extras (Setup, Intégration, ou combo) à tout moment sans repasser par un nouvel abonnement.' : 'Settings → Profile: manage your plan and buy extras anytime.'] },
      { id: 'bl-seats', title: fr ? 'Ajouter des sièges à votre équipe' : 'Add team seats', keywords: 'siège seat membre limite ajouter équipe tarif',
        body: [fr ? 'Chaque membre occupe un siège. Quand vous invitez au-delà de votre limite, CloseOS vous propose d\'ajouter des sièges (tarif selon le rôle : Setter/Closer, Setter-Closer, HOS/Admin).' : 'Each member uses a seat; add seats when inviting beyond your limit (price by role).'] },
    ],
  })

  cats.push({
    id: 'integrations', label: fr ? 'Intégrations & Assistant IA' : 'Integrations & AI Assistant', icon: Bot,
    articles: [
      { id: 'in-crm', title: fr ? 'Connecter vos outils (HubSpot, iClosed…)' : 'Connect your tools', keywords: 'hubspot pipedrive gohighlevel ghl airtable systeme.io iclosed zapier make n8n calendly',
        body: [fr ? 'CloseOS se synchronise avec HubSpot, Pipedrive, GoHighLevel, Airtable et iClosed (bidirectionnel), reçoit les leads de Systeme.io, s\'automatise via Zapier/Make/n8n, et se relie à Google Calendar et Stripe.' : 'Sync with HubSpot, Pipedrive, GoHighLevel, Airtable, iClosed, Systeme.io, Zapier/Make/n8n, Google Calendar, Stripe.'] },
      { id: 'in-mcp', title: fr ? 'Assistant IA (serveur MCP)' : 'AI Assistant (MCP server)', keywords: 'assistant ia mcp claude api clé',
        body: [fr ? 'Paramètres → Assistant IA : connectez votre assistant (ex. Claude) via le serveur MCP pour créer des prospects, planifier des RDV, lancer des relances ou générer une facture en langage naturel.' : 'Settings → AI Assistant: connect an assistant via MCP to drive your CRM in natural language.'] },
      { id: 'in-api', title: fr ? 'API & Webhooks' : 'API & Webhooks', keywords: 'api rest webhook clé bearer hmac',
        body: [fr ? 'Pour les équipes techniques : une API REST (authentification par clé, idempotence via external_id) et des Webhooks sortants signés (HMAC) permettent de connecter CloseOS à votre stack. Voir la documentation API.' : 'REST API + signed outbound webhooks. See the API docs.'] },
    ],
  })

  cats.push({
    id: 'account', label: fr ? 'Compte & Paramètres' : 'Account & Settings', icon: Settings,
    articles: [
      { id: 'ac-security', title: fr ? 'Sécurité, 2FA et connexion Google' : 'Security, 2FA & Google login', keywords: 'sécurité mot de passe 2fa google connexion appareil',
        body: [fr ? 'Paramètres → Sécurité & Connexion : changez votre mot de passe, activez la double authentification d\'appareil, gérez vos appareils de confiance et associez votre compte Google pour une connexion en un clic.' : 'Settings → Security: password, device 2FA, trusted devices, link Google.'] },
      { id: 'ac-org', title: fr ? 'Interface, organisation et profil' : 'Interface, organization & profile', keywords: 'interface thème sombre organisation profil photo fuseau',
        body: [fr ? 'Personnalisez votre profil (photo, fuseau), le thème (clair/sombre) et votre organisation depuis les Paramètres.' : 'Customize profile, theme and organization in Settings.'] },
      { id: 'ac-delete', title: fr ? 'Supprimer son compte' : 'Delete your account', keywords: 'supprimer compte suppression données',
        body: [fr ? 'Paramètres → Suppression de compte : la suppression est définitive et efface vos données. Contactez le support en cas de doute.' : 'Settings → Delete account: permanent.'] },
    ],
  })

  return cats
}

/* ─────────────────────────────────────────────────────────────
   « Par où commencer » pour les membres (Setter / Closer / Setter-Closer).
   Ordre métier : profil → offres/organisation → dispos → [prospection & booking]
   → [appels & closing] → KPIs. Ne référence que des pages accessibles aux membres.
   ───────────────────────────────────────────────────────────── */
function memberStartSteps(fr: boolean, role: Role): Step[] {
  const isS = role === 'setter' || role === 'setter-closer'
  const isC = role === 'closer' || role === 'setter-closer'

  const steps: Step[] = [
    { title: fr ? 'Complétez votre profil' : 'Complete your profile', body: fr ? "Paramètres → Profil : photo, fuseau horaire, mot de passe. Activez la double authentification et, si vous voulez, associez votre compte Google pour vous connecter en un clic." : 'Settings → Profile: photo, timezone, password. Enable 2FA and optionally link your Google account.' },
    { title: fr ? "Découvrez l'organisation & les offres" : 'Discover the organization & offers', body: fr ? "Page « Organisation » : la base de connaissances de votre équipe (scripts, process, ressources). Page « Formules » : les offres que vous vendez (prix, conditions) pour maîtriser votre discours." : 'Organization page: your team knowledge base (scripts, process, resources). Formulas page: the offers you sell (price, terms) to master your pitch.' },
    { title: fr ? 'Réglez vos disponibilités' : 'Set your availability', body: fr ? "Page « Disponibilité » : définissez vos créneaux et posez vos absences. C'est ce qui remplit votre agenda de rendez-vous." : 'Availability page: set your slots and time off. This is what fills your appointment schedule.' },
  ]

  if (isS) {
    steps.push(
      { title: fr ? 'Travaillez vos leads & vos relances' : 'Work your leads & follow-ups', body: fr ? "Pipeline : vos leads assignés. Contactez-les, faites avancer les cartes et prenez des notes. Sur l'étape « Contacté », suivez vos relances (« Relance faite »), cliquez « Répondu » dès qu'un lead répond, et ouvrez la liste « Relances » pour voir qui relancer et qui suivre." : 'Pipeline: your assigned leads. Contact them, move cards forward, take notes. On the "Contacted" stage, track your follow-ups ("Follow-up done"), click "Replied" when a lead answers, and open the "Follow-ups" list to see who to chase and who to track.' },
      { title: fr ? 'Prenez vos rendez-vous' : 'Book your appointments', body: fr ? "Depuis la fiche prospect ou vos liens de booking, calez les RDV : ils remontent automatiquement dans le pipeline et dans l'agenda du closer concerné." : 'From the prospect card or your booking links, schedule appointments: they flow automatically into the pipeline and the relevant closer\'s calendar.' },
    )
  }
  if (isC) {
    steps.push(
      { title: fr ? 'Préparez et menez vos appels' : 'Prepare and run your calls', body: fr ? "Page « Appels » et fiche prospect : ouvrez le Call Room (script, pitch de l'offre, ressources, prise de notes et enregistrement) pour mener vos closings dans les meilleures conditions." : 'Calls page and prospect card: open the Call Room (script, offer pitch, resources, notes and recording) to run your closings at their best.' },
      { title: fr ? 'Gérez vos rendez-vous' : 'Manage your appointments', body: fr ? "Page « Rendez-vous » : confirmez, reprogrammez ou traitez les no-show. Un lien Google Meet et des rappels sont générés automatiquement." : 'Appointments page: confirm, reschedule or handle no-shows. A Google Meet link and reminders are generated automatically.' },
      { title: fr ? 'Closez et encaissez' : 'Close and get paid', body: fr ? "Passez la carte en « Gagné » et encaissez via Stripe (comptant ou paiement échelonné). Le CA et vos commissions se mettent à jour automatiquement." : 'Move the card to "Won" and collect via Stripe (one-time or installments). Revenue and your commissions update automatically.' },
    )
  }

  // KPIs adaptés au rôle
  const kpiBody = role === 'setter-closer'
    ? (fr ? "Pages « KPI Setter » et « KPI Closer » : de la prise de contact au closing. « Factures » : vos commissions. « Objectifs » : vos objectifs assignés, suivis en temps réel." : '"Setter KPI" and "Closer KPI" pages: from first contact to closing. "Invoices": your commissions. "Objectives": your assigned targets, tracked in real time.')
    : isS
      ? (fr ? "Page « KPI Setter » : contactés, taux de réponse, taux de booking. « Objectifs » : vos objectifs assignés, suivis en temps réel." : '"Setter KPI" page: contacted, response rate, booking rate. "Objectives": your assigned targets, tracked in real time.')
      : (fr ? "Page « KPI Closer » : taux de closing, CA, commissions, no-show. « Factures » : vos commissions. « Objectifs » : vos objectifs assignés." : '"Closer KPI" page: closing rate, revenue, commissions, no-show. "Invoices": your commissions. "Objectives": your assigned targets.')
  steps.push({ title: fr ? 'Suivez vos KPIs & objectifs' : 'Track your KPIs & objectives', body: kpiBody })

  return steps
}

/* Catégories d'articles pour les membres, filtrées selon le rôle. */
function buildMemberCategories(fr: boolean, role: Role): Category[] {
  const isS = role === 'setter' || role === 'setter-closer'
  const isC = role === 'closer' || role === 'setter-closer'
  const cats: Category[] = []

  // Pipeline & CRM
  const pipelineArticles: Article[] = [
    { id: 'm-card', title: fr ? 'La fiche prospect' : 'The prospect card', keywords: 'fiche prospect notes tags rappel historique paiement',
      body: [fr ? "Cliquez une carte pour ouvrir la fiche : coordonnées, notes d'appel, tags, rappels, historique et informations de paiement. Glissez-déposez la carte pour la faire avancer d'une étape." : 'Click a card to open its detail: contact info, call notes, tags, reminders, history and payment info. Drag it to move it forward a stage.'] },
  ]
  if (isC) pipelineArticles.push(
    { id: 'm-callroom', title: fr ? "La salle d'appel (Call Room)" : 'The Call Room', keywords: 'call room salle appel script pitch notes enregistrement',
      body: [fr ? "« Ouvrir le Call Room » depuis la fiche : un cockpit plein écran avec votre script, le pitch de l'offre, les ressources, la prise de notes et l'enregistrement de l'appel." : '"Open the Call Room" from the card: a full-screen cockpit with script, offer pitch, resources, notes and call recording.'] },
  )
  pipelineArticles.push(
    { id: 'm-search', title: fr ? 'Rechercher & filtrer' : 'Search & filter', keywords: 'recherche filtre croix période étape offre tag',
      body: [fr ? "La barre de recherche trouve par nom, email ou téléphone (la croix la vide). Les filtres trient par période, étape, offre et tags." : 'Search by name, email or phone (the cross clears it). Filters sort by period, stage, offer and tags.'] },
  )
  cats.push({ id: 'pipeline', label: fr ? 'Pipeline & CRM' : 'Pipeline & CRM', icon: GitBranch, articles: pipelineArticles })

  // Relances & suivi de discussion
  cats.push({
    id: 'relances', label: fr ? 'Relances & suivi de discussion' : 'Follow-ups & discussion tracking', icon: Bell,
    articles: [
      { id: 'm-relance', title: fr ? 'Vos relances automatiques' : 'Your automatic follow-ups', keywords: 'relance contacté délai relance faite digest',
        body: [fr ? "Les délais de relance sont définis par votre responsable. Chaque jour, vous recevez la liste de vos relances du jour ; sur la fiche « Contacté », cliquez « Relance faite » pour passer à la relance suivante." : 'Follow-up intervals are set by your manager. Each day you get your due follow-ups; on a "Contacted" card, click "Follow-up done" to move to the next one.'] },
      { id: 'm-repondu', title: fr ? 'Bouton « Répondu » & suivi de discussion' : '"Replied" button & discussion tracking', keywords: 'répondu réponse discussion qualifié disqualifié taux de réponse',
        body: [fr ? "Sur un prospect « Contacté », cliquez « Répondu » quand il vous répond : ça compte dans votre taux de réponse et met les relances en pause." : 'On a "Contacted" prospect, click "Replied" when they answer: it counts toward your response rate and pauses follow-ups.', fr ? "Le lendemain, la fiche demande si la discussion continue : « Non » relance les relances ; « Oui » propose Qualifié / Disqualifié / Encore inconnu." : 'The next day, the card asks if the discussion continues: "No" resumes follow-ups; "Yes" offers Qualified / Disqualified / Still unknown.'] },
      { id: 'm-worklist', title: fr ? 'Liste « À relancer & à suivre »' : '"To follow up & track" list', keywords: 'liste relancer suivre worklist',
        body: [fr ? "Le bouton « Relances » (avec compteur) en haut du pipeline ouvre votre liste : qui relancer (relance due) et qui a répondu (à qualifier)." : 'The "Follow-ups" button (with counter) at the top of the pipeline opens your list: who to chase (due) and who replied (to qualify).'] },
    ],
  })

  // Rendez-vous & Booking
  const rdvArticles: Article[] = [
    { id: 'm-rdv-links', title: fr ? 'Vos liens de booking' : 'Your booking links', keywords: 'booking lien rendez-vous type créneau',
      body: [fr ? "Page « Rendez-vous » → « Liens de Booking » : créez un type de RDV (durée, disponibilités) et partagez le lien. Le prospect réserve, le RDV remonte dans votre pipeline." : 'Appointments → "Booking Links": create a type (duration, availability) and share the link. The prospect books, the appointment lands in your pipeline.'] },
    { id: 'm-rdv-gcal', title: fr ? 'Synchroniser Google Calendar' : 'Sync Google Calendar', keywords: 'google calendar agenda synchronisation conflit fuseau',
      body: [fr ? "Connectez votre Google Calendar : vos disponibilités tiennent compte de vos événements, et les fuseaux horaires du prospect sont gérés automatiquement." : 'Connect your Google Calendar: your availability accounts for your events, and the prospect timezone is handled automatically.'] },
    { id: 'm-rdv-manage', title: fr ? 'Confirmer, reprogrammer, no-show' : 'Confirm, reschedule, no-show', keywords: 'confirmer reprogrammer no-show annuler meet',
      body: [fr ? "Sur chaque rendez-vous : confirmez, reprogrammez ou traitez les no-show. Un lien Google Meet et des rappels automatiques sont générés." : 'On each appointment: confirm, reschedule or handle no-shows. A Google Meet link and automatic reminders are generated.'] },
  ]
  cats.push({ id: 'rdv', label: fr ? 'Rendez-vous & Booking' : 'Appointments & Booking', icon: Calendar, articles: rdvArticles })

  // Appels & agenda (closer / setter-closer)
  if (isC) {
    cats.push({
      id: 'appels', label: fr ? 'Appels & agenda' : 'Calls & schedule', icon: Headphones,
      articles: [
        { id: 'm-appels', title: fr ? 'Vos appels, agenda & rappels' : 'Your calls, schedule & reminders', keywords: 'appels agenda rappels planning tâches',
          body: [fr ? "Page « Appels » : vos appels à mener. Page « Agenda » : votre planning consolidé. Page « Rappels » : vos tâches et rappels personnels pour ne rien oublier." : 'Calls page: your calls to run. Agenda page: your consolidated schedule. Reminders page: your personal tasks and reminders.'] },
      ],
    })
  }

  // KPIs & Objectifs
  const kpiArticles: Article[] = []
  if (isS) kpiArticles.push({ id: 'm-kpi-setter', title: fr ? 'KPI Setter' : 'Setter KPI', keywords: 'kpi setter taux de réponse booking contacté',
    body: [fr ? "Page « KPI Setter » : contactés, taux de réponse (compte les « Répondu » et les prospects avancés), taux de booking, historique par offre." : '"Setter KPI" page: contacted, response rate, booking rate, per-offer history.'] })
  if (isC) kpiArticles.push({ id: 'm-kpi-closer', title: fr ? 'KPI Closer' : 'Closer KPI', keywords: 'kpi closer closing ca commission no-show',
    body: [fr ? "Page « KPI Closer » : taux de closing, CA, commissions, no-show, closing après R2, avec évolution vs période précédente." : '"Closer KPI" page: closing rate, revenue, commissions, no-show, closing after R2, with trend vs previous period.'] })
  kpiArticles.push({ id: 'm-obj', title: fr ? 'Vos objectifs' : 'Your objectives', keywords: 'objectif assigné personnel',
    body: [fr ? "Page « Objectifs » : vos objectifs assignés et personnels, suivis en temps réel." : '"Objectives" page: your assigned and personal targets, tracked in real time.'] })
  cats.push({ id: 'kpi', label: fr ? 'KPIs & Objectifs' : 'KPIs & Objectives', icon: BarChart3, articles: kpiArticles })

  // Facturation & commissions
  const billingArticles: Article[] = []
  if (isC) billingArticles.push({ id: 'm-encaisser', title: fr ? 'Encaisser un paiement' : 'Collect a payment', keywords: 'stripe paiement encaisser comptant échelonné',
    body: [fr ? "Sur un prospect gagné, encaissez via Stripe (comptant ou paiement échelonné). Le CA et vos commissions se mettent à jour automatiquement." : 'On a won prospect, collect via Stripe (one-time or installments). Revenue and your commissions update automatically.'] })
  billingArticles.push({ id: 'm-factures', title: fr ? 'Vos commissions & factures' : 'Your commissions & invoices', keywords: 'facture commission pdf',
    body: [fr ? "Page « Factures » : générez et retrouvez vos factures de commissions, exportables en PDF." : '"Invoices" page: generate and find your commission invoices, exportable as PDF.'] })
  cats.push({ id: 'billing', label: fr ? 'Facturation & commissions' : 'Billing & commissions', icon: Receipt, articles: billingArticles })

  // Organisation & équipe
  cats.push({
    id: 'org', label: fr ? 'Organisation & équipe' : 'Organization & team', icon: Users,
    articles: [
      { id: 'm-kb', title: fr ? 'La base de connaissances' : 'The knowledge base', keywords: 'organisation base de connaissances scripts process ressources onboarding',
        body: [fr ? "Page « Organisation » : consultez les sections et ressources (scripts, process, PDF) préparées par votre responsable pour vous onboarder." : 'Organization page: browse the sections and resources (scripts, process, PDF) prepared by your manager to onboard you.'] },
      { id: 'm-team', title: fr ? 'Votre équipe' : 'Your team', keywords: 'équipe membres rôle',
        body: [fr ? "Page « Équipe » : retrouvez les membres de votre organisation et leur rôle." : 'Team page: find your organization members and their roles.'] },
    ],
  })

  // Compte & Paramètres
  cats.push({
    id: 'account', label: fr ? 'Compte & Paramètres' : 'Account & Settings', icon: Settings,
    articles: [
      { id: 'm-security', title: fr ? 'Sécurité, 2FA & connexion Google' : 'Security, 2FA & Google login', keywords: 'sécurité mot de passe 2fa google appareil',
        body: [fr ? "Paramètres → Sécurité & Connexion : mot de passe, double authentification d'appareil, appareils de confiance et association de votre compte Google." : 'Settings → Security & Login: password, device 2FA, trusted devices and Google account linking.'] },
      { id: 'm-interface', title: fr ? 'Interface & profil' : 'Interface & profile', keywords: 'interface thème sombre profil photo fuseau',
        body: [fr ? "Paramètres : personnalisez votre profil (photo, fuseau horaire) et le thème (clair / sombre)." : 'Settings: customize your profile (photo, timezone) and the theme (light / dark).'] },
    ],
  })

  return cats
}
