import { useEffect, useState } from 'react';
import {
  ArrowRight,
  PenTool,
  CheckCircle2,
  FileSignature,
  CreditCard,
  Fingerprint,
  Globe,
  Smartphone,
  Clock,
  Mail,
  ShieldCheck,
  Lock,
  Asterisk,
  Users,
  GitBranch,
  BadgeCheck,
  Archive,
  KeyRound,
  ScanLine,
  Linkedin,
  ChevronDown,
  Files,
  UserCheck,
  LayoutDashboard,
} from 'lucide-react';
import { SignLogo } from '../components/SignLogo';
import SignContactModal from '../components/SignContactModal';

/**
 * CloseOS Sign — landing (sign.closeos.fr)
 * DA Sign : lime #CEFF8F sur fond sombre #191E1E, mockups produit, bento-grid pour le faisceau de preuves.
 * Angle produit : Sign + Pay. Valeur réelle : le faisceau de preuves opposable + le certificat de preuve.
 * Le module est complet ; Sign est INCLUS avec CloseOS Business (pas d'inscription publique).
 */

export default function SignLanding() {
  const [showContact, setShowContact] = useState(false);
  useEffect(() => {
    document.title = 'CloseOS Sign | Signez le contrat, encaissez le paiement';
    document.querySelector('meta[name="description"]')?.setAttribute(
      'content',
      "CloseOS Sign : la signature électronique qui encaisse. Faites signer le contrat ET encaissez le paiement (acompte, solde ou abonnement) dans le même geste, avec un faisceau de preuves opposable (email, OTP SMS, horodatage, IP, hash SHA-256) et un certificat de preuve vérifiable.",
    );
    document.getElementById('canonical')?.setAttribute('href', 'https://sign.closeos.fr/');
    document.getElementById('og-url')?.setAttribute('content', 'https://sign.closeos.fr/');
    document.getElementById('og-title')?.setAttribute('content', 'CloseOS Sign — Signez le contrat, encaissez le paiement');
    document.getElementById('og-description')?.setAttribute('content', "Sign + Pay : faites signer le contrat et encaissez le paiement dans le même geste, avec un certificat de preuve vérifiable.");
  }, []);

  return (
    <div className="sign-landing relative min-h-screen overflow-x-hidden bg-[#191E1E] font-sans text-[#F3F4F6] antialiased selection:bg-[#CEFF8F] selection:text-[#191E1E]">
      <style>{`
        .sign-landing { font-family: "SF Pro Display","Helvetica Neue",Helvetica,Arial,Inter,sans-serif; }
        .sign-landing .bg-noise { position: relative; }
        .sign-landing .bg-noise::before {
          content: ""; position: absolute; inset: 0; pointer-events: none; z-index: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
        }
        .sign-landing .wire-r { position:absolute; right:-24px; top:50%; width:24px; height:1px; background:#3A4242; }
        .sign-landing .wire-l { position:absolute; left:-80px; top:50%; width:80px; height:1px; background:#3A4242; }
        .sign-landing .wire-b { position:absolute; bottom:-60px; left:50%; width:1px; height:60px; background:#3A4242; }
        .sign-landing .glow-point { position:absolute; width:5px; height:5px; border-radius:50%; background:#CEFF8F; box-shadow:0 0 10px #CEFF8F; }
        .sign-landing .hover-lift { transition: transform .3s cubic-bezier(0.16,1,0.3,1), border-color .3s ease; }
        .sign-landing .hover-lift:hover { transform: translateY(-4px); border-color:#CEFF8F; }
      `}</style>

      {/* Top Announcement Bar */}
      <div className="relative z-50 flex items-center justify-between gap-3 bg-[#CEFF8F] px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[#191E1E]">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 rounded-sm bg-[#191E1E] px-2 py-0.5 text-[#CEFF8F]">Sign + Pay</span>
          <span className="hidden sm:inline">Signez le contrat et encaissez le paiement dans le même geste.</span>
          <span className="truncate sm:hidden">Signez et encaissez d’un seul geste.</span>
        </div>
        <a href="/sign/abonnement" className="flex shrink-0 items-center gap-1 transition-opacity hover:opacity-70">
          <span className="hidden sm:inline">Essayer gratuitement</span><span className="sm:hidden">Essayer</span> <ArrowRight className="h-3 w-3" strokeWidth={2.5} />
        </a>
      </div>

      {/* Navigation */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-[#3A4242] bg-[#191E1E]/90 px-4 py-4 backdrop-blur-md sm:px-6 md:px-12">
        <div className="flex items-center gap-8">
          <div className="relative group flex items-center gap-1.5">
            <a href="/sign" className="flex items-center">
              <SignLogo className="text-lg" />
            </a>
            <ChevronDown className="h-4 w-4 text-[#A1A9A9] transition-transform duration-300 group-hover:rotate-180 group-hover:text-white" />
            <div className="absolute left-0 top-full z-50 mt-3 w-64 translate-y-2 opacity-0 invisible transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-hover:visible">
              <div className="flex flex-col gap-1 rounded-xl border border-[#3A4242] bg-[#222828] p-2 shadow-2xl">
                <a href="/landing" className="flex items-center justify-center rounded-lg px-4 py-3 transition-colors hover:bg-[#191E1E]">
                  <img src="/logo-sales.png" alt="CloseOS Sales" className="h-auto w-[160px] object-contain" loading="lazy" />
                </a>
                <a href="/business" className="flex items-center justify-center rounded-lg px-4 py-3 transition-colors hover:bg-[#191E1E]">
                  <img src="/closeos-business-logo-ecrit-dark.png" alt="CloseOS Business" className="h-auto w-[160px] object-contain" loading="lazy" />
                </a>
              </div>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-sm font-medium text-[#A1A9A9] lg:flex">
            <a href="#concept" className="transition-colors hover:text-[#F3F4F6]">Sign + Pay</a>
            <a href="#multi" className="transition-colors hover:text-[#F3F4F6]">Multi-signataire</a>
            <a href="#modeles" className="transition-colors hover:text-[#F3F4F6]">Modèles</a>
            <a href="#preuve" className="transition-colors hover:text-[#F3F4F6]">Faisceau de preuves</a>
            <a href="#securite" className="transition-colors hover:text-[#F3F4F6]">Sécurité</a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <a href="/sign/login" className="hidden text-sm font-medium transition-colors hover:text-[#F3F4F6] md:block">Connexion</a>
          <a href="/sign/abonnement" className="rounded bg-[#CEFF8F] px-5 py-2 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC]">
            Essai gratuit
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-noise relative overflow-hidden border-b border-[#3A4242] px-4 pb-20 pt-16 sm:px-6 sm:pb-32 sm:pt-24 md:px-12">
        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Copy */}
          <div className="space-y-6 sm:space-y-8">
            <div className="inline-flex items-center gap-2 rounded border border-[#3A4242] bg-[#222828] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#CEFF8F]">
              <BadgeCheck className="h-3.5 w-3.5" /> 14 jours d’essai gratuit · sans engagement
            </div>
            <h1 className="text-[30px] font-semibold leading-[1.08] tracking-tight text-white sm:text-[40px] sm:leading-[1.05] lg:text-[52px]">
              Signez le contrat,<br />
              <span className="text-[#CEFF8F]">encaissez le paiement.</span><br />
              Dans le même geste.
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-[#A1A9A9]">
              La signature électronique qui encaisse. Ne laissez plus un deal refroidir entre la signature et le
              virement : CloseOS Sign lie la validation du contrat à son paiement sur un seul écran — avec un
              faisceau de preuves opposable et un certificat vérifiable.
            </p>
            <div className="flex flex-col gap-4 pt-4 sm:flex-row">
              <a href="/sign/abonnement" className="flex items-center justify-center gap-2 rounded bg-[#CEFF8F] px-8 py-3 text-center font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC]">
                Démarrer l’essai gratuit <ArrowRight className="h-4 w-4" />
              </a>
              <a href="#preuve" className="rounded border border-[#3A4242] bg-transparent px-8 py-3 text-center font-medium text-white transition-colors hover:border-[#A1A9A9]">
                Voir le faisceau de preuves
              </a>
            </div>
          </div>

          {/* Mockup */}
          <div className="relative hidden h-[500px] w-full select-none md:block">
            <div className="absolute inset-0 top-1/2 h-[1px] w-full bg-[#3A4242]" />
            <div className="absolute inset-0 left-1/2 h-full w-[1px] bg-[#3A4242]" />

            {/* Contract card */}
            <div className="absolute left-[10%] top-[15%] z-20 w-[240px] rounded border border-[#3A4242] bg-[#222828] p-4 shadow-2xl">
              <div className="mb-6 h-2 w-12 rounded bg-[#3A4242]" />
              <div className="mb-8 space-y-3">
                <div className="h-1.5 w-full rounded bg-[#3A4242]/50" />
                <div className="h-1.5 w-[85%] rounded bg-[#3A4242]/50" />
                <div className="h-1.5 w-[90%] rounded bg-[#3A4242]/50" />
                <div className="h-1.5 w-[60%] rounded bg-[#3A4242]/50" />
              </div>
              <div className="rounded border border-dashed border-[#CEFF8F] bg-[#CEFF8F]/10 p-2 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#CEFF8F]">Zone de signature</span>
              </div>
              <div className="wire-r" />
              <div className="glow-point -right-1 top-1/2 -translate-y-1/2" />
            </div>

            {/* Sign action */}
            <div className="absolute right-[10%] top-[8%] z-30 flex w-[200px] items-center gap-3 rounded border border-[#3A4242] bg-[#222828] p-3 shadow-xl">
              <div className="flex h-8 w-8 items-center justify-center rounded border border-[#3A4242] bg-[#191E1E] text-[#CEFF8F]">
                <PenTool className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-white">Marc Dupont</p>
                <p className="mt-0.5 text-[10px] uppercase text-[#A1A9A9]">Identité vérifiée</p>
              </div>
              <div className="wire-b" />
            </div>

            {/* Pay action */}
            <div className="absolute right-[5%] top-[45%] z-40 w-[220px] rounded border border-[#CEFF8F] bg-[#CEFF8F] p-4 shadow-[0_0_40px_rgba(206,255,143,0.15)]">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-bold text-[#191E1E]">Paiement sécurisé</span>
                <CheckCircle2 className="h-4 w-4 text-[#191E1E]" fill="currentColor" stroke="#CEFF8F" />
              </div>
              <div className="mb-3 text-[10px] text-[#191E1E]/80">Paiement lié au contrat #4092</div>
              <button className="w-full rounded bg-[#191E1E] py-2 text-xs font-bold text-[#CEFF8F]">
                Payer 1 500 € &amp; Signer
              </button>
              <div className="wire-l" />
            </div>

            <div className="absolute bottom-[15%] left-[40%] text-[#3A4242]">
              <Asterisk className="h-9 w-9 animate-[spin_20s_linear_infinite]" />
            </div>
          </div>
        </div>

        {/* Trusted by */}
        <div className="relative z-10 mx-auto mt-16 max-w-7xl border-t border-[#3A4242] pt-10 sm:mt-24">
          <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
            <span className="text-center text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9] md:text-left">
              Paiements propulsés par Stripe · Module de l’écosystème CloseOS
            </span>
            <div className="flex flex-wrap justify-center gap-8 opacity-50 grayscale md:gap-16">
              <span className="text-xl font-bold tracking-tighter">Stripe.</span>
              <span className="text-lg font-bold">CloseOS Business</span>
              <span className="text-xl font-bold tracking-wide">RGPD</span>
            </div>
          </div>
        </div>
      </section>

      {/* Concept : Sign + Pay */}
      <section id="concept" className="relative border-b border-[#3A4242] px-4 py-16 sm:px-6 sm:py-24 md:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-16">
            <div className="mb-4 inline-block rounded border border-[#3A4242] bg-[#222828] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#CEFF8F]">
              Le flux unique
            </div>
            <h2 className="text-[26px] font-semibold tracking-tight text-white sm:text-4xl">
              Le moment de la signature est votre pic émotionnel. Ne le brisez pas.
            </h2>
          </div>

          <div className="grid overflow-hidden rounded border border-[#3A4242] lg:grid-cols-2">
            {/* Signature */}
            <div className="relative bg-[#222828] p-7 sm:p-12">
              <div className="absolute right-6 top-6 flex h-8 w-8 items-center justify-center rounded border border-[#3A4242] text-[#A1A9A9]">1</div>
              <div className="mb-8 flex h-12 w-12 items-center justify-center rounded border border-[#3A4242] bg-[#191E1E]">
                <FileSignature className="h-6 w-6 text-[#F3F4F6]" />
              </div>
              <h3 className="mb-4 text-2xl font-medium text-white">Signature fluide, sans friction.</h3>
              <p className="mb-8 text-sm leading-relaxed text-[#A1A9A9]">
                Composez le contrat depuis un modèle, une feuille blanche ou un PDF importé. Posez les champs en glisser-déposer.
                Votre client ouvre le lien sur mobile ou desktop — aucune création de compte requise — et signe en un clic.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#CEFF8F]" />
                  <span className="text-[#F3F4F6]">Modèles, import PDF et éditeur en glisser-déposer.</span>
                </li>
                <li className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#CEFF8F]" />
                  <span className="text-[#F3F4F6]">Champs pré-remplis depuis votre carnet de contacts.</span>
                </li>
                <li className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#CEFF8F]" />
                  <span className="text-[#F3F4F6]">100% responsive, lecture claire sur mobile.</span>
                </li>
              </ul>
            </div>

            {/* Payment */}
            <div className="relative border-t border-[#3A4242] bg-[#1D2323] p-7 sm:p-12 lg:border-l lg:border-t-0">
              <div className="absolute right-6 top-6 flex h-8 w-8 items-center justify-center rounded border border-[#3A4242] text-[#A1A9A9]">2</div>
              <div className="mb-8 flex h-12 w-12 items-center justify-center rounded border border-[#CEFF8F]/30 bg-[#CEFF8F]/10">
                <CreditCard className="h-6 w-6 text-[#CEFF8F]" />
              </div>
              <h3 className="mb-4 text-2xl font-medium text-white">« Payé + signé », d’un seul geste.</h3>
              <p className="mb-8 text-sm leading-relaxed text-[#A1A9A9]">
                Activez le paiement sur le contrat : le signataire règle le paiement (acompte, solde ou abonnement) pour valider. Via Stripe Connect,
                l’argent arrive <span className="text-[#F3F4F6]">directement sur votre compte</span>. Le document est ensuite scellé et
                envoyé aux deux parties.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#CEFF8F]" />
                  <span className="text-[#F3F4F6]">Paiement par carte sécurisé via Stripe, sur votre compte.</span>
                </li>
                <li className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#CEFF8F]" />
                  <span className="text-[#F3F4F6]">Paiement assignable à un signataire précis, ou à tous.</span>
                </li>
                <li className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#CEFF8F]" />
                  <span className="text-[#F3F4F6]">Engagement financier qui verrouille l’accord.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Multi-signataire */}
      <section id="multi" className="border-b border-[#3A4242] px-4 py-16 sm:px-6 sm:py-24 md:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 max-w-2xl sm:mb-16">
            <div className="mb-4 inline-block rounded border border-[#3A4242] bg-[#222828] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#CEFF8F]">
              Plusieurs parties
            </div>
            <h2 className="text-[28px] font-semibold tracking-tight text-white sm:text-[36px] lg:text-[44px]">
              Un, deux, dix signataires.<br />
              <span className="text-[#A1A9A9]">Chacun sa vérification, chacun son rôle.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="hover-lift rounded border border-[#3A4242] bg-[#222828] p-8">
              <Users className="mb-6 h-8 w-8 text-[#CEFF8F]" />
              <h4 className="mb-2 text-lg font-medium text-white">Plusieurs signataires</h4>
              <p className="text-sm text-[#A1A9A9]">
                Ajoutez autant de signataires que nécessaire. Chacun reçoit son propre lien sécurisé et ses propres champs,
                avec une couleur dédiée dans l’éditeur.
              </p>
            </div>
            <div className="hover-lift rounded border border-[#3A4242] bg-[#222828] p-8">
              <GitBranch className="mb-6 h-8 w-8 text-[#CEFF8F]" />
              <h4 className="mb-2 text-lg font-medium text-white">Parallèle ou séquentiel</h4>
              <p className="text-sm text-[#A1A9A9]">
                Tout le monde signe quand il veut, ou dans un ordre imposé (1 → 2 → 3) : le signataire suivant n’est sollicité
                qu’une fois le précédent passé.
              </p>
            </div>
            <div className="hover-lift rounded border border-[#3A4242] bg-[#222828] p-8">
              <Fingerprint className="mb-6 h-8 w-8 text-[#CEFF8F]" />
              <h4 className="mb-2 text-lg font-medium text-white">Vérification par signataire</h4>
              <p className="text-sm text-[#A1A9A9]">
                Chaque signataire a sa propre liste de vérification (email / SMS), et le paiement peut être demandé à un
                signataire précis — indépendamment de sa vérification.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contrats réutilisables (templates) + espaces par membre */}
      <section id="modeles" className="border-b border-[#3A4242] px-4 py-16 sm:px-6 sm:py-24 md:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 max-w-2xl sm:mb-16">
            <div className="mb-4 inline-block rounded border border-[#3A4242] bg-[#222828] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#CEFF8F]">
              Contrats réutilisables
            </div>
            <h2 className="text-[28px] font-semibold tracking-tight text-white sm:text-[36px] lg:text-[44px]">
              Un modèle, mille signatures.<br />
              <span className="text-[#A1A9A9]">Un espace par membre de votre équipe.</span>
            </h2>
            <p className="mt-5 text-base leading-relaxed text-[#A1A9A9]">
              Créez un contrat-type une seule fois. Chaque envoi génère une copie figée et indépendante, avec son propre
              certificat de preuve — modifier le modèle n’altère jamais les documents déjà signés.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="hover-lift rounded border border-[#3A4242] bg-[#222828] p-8">
              <Files className="mb-6 h-8 w-8 text-[#CEFF8F]" />
              <h4 className="mb-2 text-lg font-medium text-white">Modèle réutilisable</h4>
              <p className="text-sm text-[#A1A9A9]">
                Le même contrat envoyé à l’infini. Chaque signature crée une instance scellée à part — le modèle, lui, ne se
                consomme jamais et reste modifiable.
              </p>
            </div>
            <div className="hover-lift rounded border border-[#3A4242] bg-[#222828] p-8">
              <UserCheck className="mb-6 h-8 w-8 text-[#CEFF8F]" />
              <h4 className="mb-2 text-lg font-medium text-white">Un espace par membre</h4>
              <p className="text-sm text-[#A1A9A9]">
                Donnez à chaque commercial, closer ou collaborateur son propre accès sécurisé (code email + appareil de
                confiance) pour générer ses liens et suivre ses signatures — sans jamais voir celles des autres.
              </p>
            </div>
            <div className="hover-lift rounded border border-[#3A4242] bg-[#222828] p-8">
              <LayoutDashboard className="mb-6 h-8 w-8 text-[#CEFF8F]" />
              <h4 className="mb-2 text-lg font-medium text-white">Suivi & attribution</h4>
              <p className="text-sm text-[#A1A9A9]">
                Qui a généré quoi, combien de contrats signés, en attente ou expirés. Liens valables 7 jours et révocation
                d’un accès en un clic — l’historique reste intact.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Faisceau de preuves — bento grid */}
      <section id="preuve" className="border-b border-[#3A4242] px-4 py-16 sm:px-6 sm:py-24 md:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 sm:mb-16">
            <h2 className="text-[28px] font-semibold tracking-tight text-white sm:text-[36px] lg:text-[48px]">
              Pas juste une signature.<br />
              <span className="text-[#A1A9A9]">Un faisceau de preuves inattaquable.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
            {/* Hash */}
            <div className="hover-lift col-span-1 flex min-h-[300px] flex-col justify-between rounded border border-[#3A4242] bg-[#222828] p-8 md:col-span-4">
              <div className="flex items-start justify-between">
                <Fingerprint className="h-9 w-9 text-[#F3F4F6]" />
                <span className="rounded border border-[#3A4242] bg-[#191E1E] px-2 py-1 text-[10px] uppercase">Cryptographie</span>
              </div>
              <div>
                <h4 className="mb-2 text-xl font-medium text-white">Hash cryptographique unique (SHA-256)</h4>
                <p className="max-w-md text-sm text-[#A1A9A9]">
                  Le document scellé est haché côté serveur sur les octets réellement reçus. La moindre modification
                  ultérieure invalide le hash. Document et certificat de preuve sont liés à vie.
                </p>
              </div>
            </div>

            {/* IP */}
            <div className="hover-lift col-span-1 flex min-h-[300px] flex-col justify-between rounded border border-[#3A4242] bg-[#222828] p-8 md:col-span-2">
              <Globe className="mb-8 h-8 w-8 text-[#A1A9A9]" />
              <div>
                <h4 className="mb-2 text-lg font-medium text-white">Traçabilité IP &amp; appareil</h4>
                <p className="text-xs text-[#A1A9A9]">
                  Adresse IP, navigateur et appareil enregistrés côté serveur au moment précis de chaque interaction.
                </p>
              </div>
            </div>

            {/* OTP */}
            <div className="hover-lift col-span-1 rounded border border-[#3A4242] bg-[#222828] p-8 md:col-span-2">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded border border-[#3A4242] bg-[#191E1E]">
                  <Smartphone className="h-4 w-4 text-[#CEFF8F]" />
                </div>
                <h4 className="text-base font-medium text-white">Vérification email &amp; SMS</h4>
              </div>
              <p className="text-xs text-[#A1A9A9]">
                Code à 6 chiffres par email, par SMS, ou les deux — avant la signature. Blocage anti-fraude après plusieurs
                tentatives échouées.
              </p>
            </div>

            {/* Horodatage */}
            <div className="hover-lift col-span-1 rounded border border-[#3A4242] bg-[#222828] p-8 md:col-span-2">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded border border-[#3A4242] bg-[#191E1E]">
                  <Clock className="h-4 w-4 text-[#CEFF8F]" />
                </div>
                <h4 className="text-base font-medium text-white">Horodatage serveur</h4>
              </div>
              <p className="text-xs text-[#A1A9A9]">
                Chaque étape est horodatée côté serveur (UTC), pas sur l’horloge locale du signataire, pour une chronologie
                fiable.
              </p>
            </div>

            {/* Email */}
            <div className="hover-lift relative col-span-1 overflow-hidden rounded border border-[#3A4242] bg-[#222828] p-8 md:col-span-2">
              <div className="absolute -bottom-4 -right-4 opacity-5">
                <Mail className="h-32 w-32" />
              </div>
              <div className="relative z-10">
                <div className="mb-4 flex h-8 w-8 items-center justify-center rounded border border-[#3A4242] bg-[#191E1E]">
                  <Mail className="h-4 w-4 text-[#CEFF8F]" />
                </div>
                <h4 className="mb-2 text-base font-medium text-white">Journal d’événements inviolable</h4>
                <p className="text-xs text-[#A1A9A9]">
                  Création, envois, ouvertures, vérifications, paiement, scellement : tout est consigné dans un journal
                  append-only, source unique de vérité.
                </p>
              </div>
            </div>
          </div>

          {/* Certificat de preuve */}
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-6">
            <div className="hover-lift col-span-1 flex flex-col justify-between rounded border border-[#3A4242] bg-[#1D2323] p-8 md:col-span-3">
              <BadgeCheck className="mb-6 h-9 w-9 text-[#CEFF8F]" />
              <div>
                <h4 className="mb-2 text-xl font-medium text-white">Certificat de preuve, joint au document</h4>
                <p className="text-sm text-[#A1A9A9]">
                  À la complétion, un certificat est généré une fois puis figé : identités, méthode de vérification, timeline,
                  IP, preuve de paiement, hashs. Il voyage avec le document signé.
                </p>
              </div>
            </div>
            <div className="hover-lift col-span-1 flex flex-col justify-between rounded border border-[#3A4242] bg-[#1D2323] p-8 md:col-span-3">
              <ScanLine className="mb-6 h-9 w-9 text-[#CEFF8F]" />
              <div>
                <h4 className="mb-2 text-xl font-medium text-white">Vérification publique</h4>
                <p className="text-sm text-[#A1A9A9]">
                  Une page de vérification permet à n’importe qui de contrôler l’authenticité d’un document et de son certificat
                  — les coordonnées sensibles restant masquées hors des parties concernées.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Regulatory ticker */}
      <section className="overflow-hidden bg-[#CEFF8F] px-4 py-8">
        <div className="flex animate-[pulse_10s_ease-in-out_infinite] flex-wrap justify-center gap-x-8 gap-y-3 text-[#191E1E] opacity-90 sm:gap-x-12">
          {[
            { icon: ShieldCheck, label: 'Faisceau de preuves opposable' },
            { icon: Clock, label: 'Horodatage serveur (UTC)' },
            { icon: Archive, label: 'Conservation 5 ans + legal hold' },
            { icon: Lock, label: 'RGPD Compliant' },
          ].map((item) => (
            <span key={item.label} className="flex items-center gap-3 text-base font-bold uppercase tracking-widest sm:gap-4 sm:text-xl">
              <item.icon className="h-5 w-5" strokeWidth={2.5} /> {item.label}
            </span>
          ))}
        </div>
      </section>

      {/* Sécurité */}
      <section id="securite" className="border-b border-[#3A4242] px-4 py-16 sm:px-6 sm:py-24 md:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 max-w-2xl sm:mb-16">
            <div className="mb-4 inline-block rounded border border-[#3A4242] bg-[#222828] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#CEFF8F]">
              Sécurité
            </div>
            <h2 className="text-[28px] font-semibold tracking-tight text-white sm:text-[36px] lg:text-[44px]">
              Vos contrats et vos paiements,<br />
              <span className="text-[#A1A9A9]">protégés à chaque couche.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="hover-lift rounded border border-[#3A4242] bg-[#222828] p-8">
              <Smartphone className="mb-6 h-8 w-8 text-[#CEFF8F]" />
              <h4 className="mb-2 text-lg font-medium text-white">Double authentification</h4>
              <p className="text-sm text-[#A1A9A9]">
                Connexion vérifiée sur chaque nouvel appareil (code email), appareil de confiance 7 jours, et alerte de
                connexion.
              </p>
            </div>
            <div className="hover-lift rounded border border-[#3A4242] bg-[#222828] p-8">
              <KeyRound className="mb-6 h-8 w-8 text-[#CEFF8F]" />
              <h4 className="mb-2 text-lg font-medium text-white">Accès cloisonné</h4>
              <p className="text-sm text-[#A1A9A9]">
                Données isolées par compte (sécurité au niveau des lignes), accès signataire limité à son seul document via un
                lien à usage contrôlé.
              </p>
            </div>
            <div className="hover-lift rounded border border-[#3A4242] bg-[#222828] p-8">
              <Lock className="mb-6 h-8 w-8 text-[#CEFF8F]" />
              <h4 className="mb-2 text-lg font-medium text-white">Conforme RGPD</h4>
              <p className="text-sm text-[#A1A9A9]">
                Conservation maîtrisée (5 ans + legal hold), export de vos données à la demande, journal de preuves conservé avec le contrat.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="bg-noise relative px-4 py-20 sm:px-6 sm:py-32 md:px-12">
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <div className="mb-8 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded border border-[#CEFF8F] bg-[#CEFF8F]/10 shadow-[0_0_30px_rgba(206,255,143,0.1)]">
              <FileSignature className="h-8 w-8 text-[#CEFF8F]" />
            </div>
          </div>
          <h2 className="mb-6 text-[28px] font-semibold tracking-tight text-white sm:text-4xl">
            Essayez CloseOS Sign,<br />14 jours gratuits.
          </h2>
          <p className="mb-12 text-sm text-[#A1A9A9]">
            Signez et encaissez dès aujourd’hui. Sans engagement, annulable à tout moment.
            Déjà client CloseOS Business ? Votre accès Sign est inclus.
          </p>

          <div className="mx-auto flex max-w-xl flex-col justify-center gap-3 sm:flex-row">
            <a href="/sign/abonnement" className="flex items-center justify-center gap-2 whitespace-nowrap rounded bg-[#CEFF8F] px-8 py-3 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC]">
              Démarrer l’essai gratuit <ArrowRight className="h-4 w-4" />
            </a>
            <a href="/sign/login" className="flex items-center justify-center gap-2 whitespace-nowrap rounded border border-[#3A4242] px-8 py-3 text-sm font-medium text-white transition-colors hover:border-[#A1A9A9]">
              Se connecter
            </a>
          </div>
          <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-[#A1A9A9]">
            <Lock className="h-3 w-3" fill="currentColor" /> <span>Signature électronique conforme RGPD — vos données ne sont jamais revendues.</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#3A4242] bg-[#191E1E] px-4 pb-8 pt-16 sm:px-6 md:px-12">
        <div className="mx-auto mb-16 grid max-w-7xl grid-cols-2 gap-12 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <div className="mb-6 flex items-center">
              <SignLogo className="text-sm" muted />
            </div>
            <p className="max-w-xs text-[11px] leading-relaxed text-[#A1A9A9]">
              La signature électronique pensée pour les cycles de vente rapides. Sécurisation du contrat couplée au paiement
              instantané.
            </p>
          </div>

          <div>
            <h5 className="mb-4 text-xs font-bold uppercase tracking-widest text-white">Produit</h5>
            <ul className="space-y-3">
              <li><a href="#concept" className="text-[11px] text-[#A1A9A9] transition-colors hover:text-white">Sign + Pay</a></li>
              <li><a href="#multi" className="text-[11px] text-[#A1A9A9] transition-colors hover:text-white">Multi-signataire</a></li>
              <li><a href="#modeles" className="text-[11px] text-[#A1A9A9] transition-colors hover:text-white">Modèles réutilisables</a></li>
              <li><a href="#preuve" className="text-[11px] text-[#A1A9A9] transition-colors hover:text-white">Faisceau de preuves &amp; certificat</a></li>
              <li><a href="#securite" className="text-[11px] text-[#A1A9A9] transition-colors hover:text-white">Sécurité</a></li>
            </ul>
          </div>

          <div>
            <h5 className="mb-4 text-xs font-bold uppercase tracking-widest text-white">Écosystème</h5>
            <ul className="space-y-3">
              <li><a href="/business" className="text-[11px] text-[#A1A9A9] transition-colors hover:text-white">CloseOS Business</a></li>
              <li><a href="/tarifs" className="text-[11px] text-[#A1A9A9] transition-colors hover:text-white">Tarifs</a></li>
              <li><a href="/sign/login" className="text-[11px] text-[#A1A9A9] transition-colors hover:text-white">Connexion</a></li>
            </ul>
          </div>

          <div>
            <h5 className="mb-4 text-xs font-bold uppercase tracking-widest text-white">Légal</h5>
            <ul className="space-y-3">
              <li><a href="/sign/cgv" className="text-[11px] text-[#A1A9A9] transition-colors hover:text-white">CGV &amp; CGU</a></li>
              <li><a href="/sign/confidentialite" className="text-[11px] text-[#A1A9A9] transition-colors hover:text-white">Politique de confidentialité</a></li>
              <li><a href="/sign/securite" className="text-[11px] text-[#A1A9A9] transition-colors hover:text-white">Sécurité technique</a></li>
            </ul>
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between border-t border-[#3A4242] pt-8 md:flex-row">
          <span className="text-[10px] text-[#A1A9A9]">© {new Date().getFullYear()} CloseOS. Tous droits réservés.</span>
          <div className="mt-4 flex gap-4 text-[#A1A9A9] md:mt-0">
            <a href="https://www.linkedin.com/in/thomas-shamoev-570885237/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="transition-colors hover:text-white"><Linkedin className="h-5 w-5" /></a>
            <button type="button" onClick={() => setShowContact(true)} className="flex items-center gap-1.5 text-[11px] text-[#A1A9A9] transition-colors hover:text-white"><Mail className="h-4 w-4" /> support@closeos.fr</button>
          </div>
        </div>
      </footer>

      <SignContactModal open={showContact} onClose={() => setShowContact(false)} />
    </div>
  );
}
