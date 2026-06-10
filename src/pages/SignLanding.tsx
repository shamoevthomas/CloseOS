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
  MailOpen,
  ShieldCheck,
  Scale,
  Archive,
  Lock,
  Quote,
  Rocket,
  Linkedin,
  Twitter,
  Asterisk,
  Check,
} from 'lucide-react';

/**
 * CloseOS Sign — landing (sign.closeos.fr)
 * Design repris de Yousign (via aidesigner, mode inspire) : palette lime #CEFF8F
 * sur fond sombre #191E1E, mockups produit, bento-grid pour le faisceau de preuves.
 * Angle produit : sign + pay. Valeur réelle : le faisceau de preuves opposable.
 */

const Logo = ({ className = '' }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" />
    <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function SignLanding() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    document.title = 'CloseOS Sign | Signez le contrat, encaissez l’acompte';
    document.querySelector('meta[name="description"]')?.setAttribute(
      'content',
      "CloseOS Sign : la signature électronique pensée pour les closers. Faites signer le contrat ET encaissez l'acompte dans le même geste, avec un faisceau de preuves opposable (email, OTP SMS, horodatage eIDAS, IP, hash).",
    );
    document.getElementById('canonical')?.setAttribute('href', 'https://sign.closeos.fr/');
    document.getElementById('og-url')?.setAttribute('content', 'https://sign.closeos.fr/');
    document.getElementById('og-title')?.setAttribute('content', 'CloseOS Sign — Signez le contrat, encaissez l’acompte');
    document.getElementById('og-description')?.setAttribute('content', "Sign + Pay : faites signer le contrat et encaissez l'acompte dans le même geste.");
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitted(true);
  };

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
      <div className="relative z-50 flex items-center justify-between bg-[#CEFF8F] px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[#191E1E]">
        <div className="flex items-center gap-2">
          <span className="rounded-sm bg-[#191E1E] px-2 py-0.5 text-[#CEFF8F]">Nouveau</span>
          <span>CloseOS Sign est actuellement en Beta Privée.</span>
        </div>
        <a href="#attente" className="flex items-center gap-1 transition-opacity hover:opacity-70">
          Rejoindre la liste d’attente <ArrowRight className="h-3 w-3" strokeWidth={2.5} />
        </a>
      </div>

      {/* Navigation */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[#3A4242] bg-[#191E1E]/90 px-6 py-4 backdrop-blur-md md:px-12">
        <div className="flex items-center gap-8">
          <a href="/sign" className="flex items-center">
            <Logo className="text-[#CEFF8F]" />
            <span className="ml-2 text-lg font-semibold tracking-tight text-white">
              CloseOS <span className="font-normal text-[#A1A9A9]">| Sign</span>
            </span>
          </a>
          <nav className="hidden items-center gap-6 text-sm font-medium text-[#A1A9A9] lg:flex">
            <a href="#concept" className="transition-colors hover:text-[#F3F4F6]">Le Concept</a>
            <a href="#preuve" className="transition-colors hover:text-[#F3F4F6]">Preuve Légale</a>
            <a href="#attente" className="transition-colors hover:text-[#F3F4F6]">Accès</a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <a href="/sign/login" className="hidden text-sm font-medium transition-colors hover:text-[#F3F4F6] md:block">Connexion</a>
          <a href="#attente" className="rounded bg-[#CEFF8F] px-5 py-2 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC]">
            Accès Anticipé
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-noise relative overflow-hidden border-b border-[#3A4242] px-6 pb-32 pt-24 md:px-12">
        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-2">
          {/* Copy */}
          <div className="space-y-8">
            <h1 className="text-[40px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[52px]">
              Signez le contrat,<br />
              <span className="text-[#CEFF8F]">encaissez l’acompte.</span><br />
              Dans le même geste.
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-[#A1A9A9]">
              Le premier module de signature européenne taillé pour les closers. Ne laissez plus un deal refroidir entre la
              signature et le virement. CloseOS Sign lie la validation juridique au paiement de l’acompte sur un seul et
              même écran.
            </p>
            <div className="flex flex-col gap-4 pt-4 sm:flex-row">
              <a href="#attente" className="rounded bg-[#CEFF8F] px-8 py-3 text-center font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC]">
                Rejoindre la Waitlist
              </a>
              <a href="#preuve" className="rounded border border-[#3A4242] bg-transparent px-8 py-3 text-center font-medium text-white transition-colors hover:border-[#A1A9A9]">
                Voir le Faisceau de Preuves
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
                <p className="mt-0.5 text-[10px] uppercase text-[#A1A9A9]">Identification terminée</p>
              </div>
              <div className="wire-b" />
            </div>

            {/* Pay action */}
            <div className="absolute right-[5%] top-[45%] z-40 w-[220px] rounded border border-[#CEFF8F] bg-[#CEFF8F] p-4 shadow-[0_0_40px_rgba(206,255,143,0.15)]">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-bold text-[#191E1E]">Paiement Sécurisé</span>
                <CheckCircle2 className="h-4 w-4 text-[#191E1E]" fill="currentColor" stroke="#CEFF8F" />
              </div>
              <div className="mb-3 text-[10px] text-[#191E1E]/80">Acompte lié au contrat #4092</div>
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
        <div className="relative z-10 mx-auto mt-24 max-w-7xl border-t border-[#3A4242] pt-10">
          <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">
              Conçu pour les écosystèmes exigeants
            </span>
            <div className="flex flex-wrap justify-center gap-8 opacity-50 grayscale md:gap-16">
              <span className="text-xl font-bold tracking-tighter">Stripe.</span>
              <span className="font-serif text-xl italic">HubSpot</span>
              <span className="text-xl font-bold tracking-wide">Zapier</span>
              <span className="text-lg font-bold">Google Workspace</span>
            </div>
          </div>
        </div>
      </section>

      {/* Concept : Sign + Pay */}
      <section id="concept" className="relative border-b border-[#3A4242] px-6 py-24 md:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <div className="mb-4 inline-block rounded border border-[#3A4242] bg-[#222828] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#CEFF8F]">
              Le Flux Unique
            </div>
            <h2 className="text-4xl font-semibold tracking-tight text-white">
              Le moment de la signature est votre pic émotionnel. Ne le brisez pas.
            </h2>
          </div>

          <div className="grid overflow-hidden rounded border border-[#3A4242] lg:grid-cols-2">
            {/* Signature */}
            <div className="relative bg-[#222828] p-12">
              <div className="absolute right-6 top-6 flex h-8 w-8 items-center justify-center rounded border border-[#3A4242] text-[#A1A9A9]">1</div>
              <div className="mb-8 flex h-12 w-12 items-center justify-center rounded border border-[#3A4242] bg-[#191E1E]">
                <FileSignature className="h-6 w-6 text-[#F3F4F6]" />
              </div>
              <h3 className="mb-4 text-2xl font-medium text-white">Signature fluide, sans friction.</h3>
              <p className="mb-8 text-sm leading-relaxed text-[#A1A9A9]">
                Envoyez votre document. Votre client ouvre le lien sur mobile ou desktop. Aucune création de compte requise.
                L’interface s’adapte parfaitement pour une lecture claire et une signature en un clic.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#CEFF8F]" />
                  <span className="text-[#F3F4F6]">Navigation optimisée mobile (100% responsive).</span>
                </li>
                <li className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#CEFF8F]" />
                  <span className="text-[#F3F4F6]">Champs pré-remplis via l’intégration CloseOS CRM.</span>
                </li>
              </ul>
            </div>

            {/* Payment */}
            <div className="relative border-t border-[#3A4242] bg-[#1D2323] p-12 lg:border-l lg:border-t-0">
              <div className="absolute right-6 top-6 flex h-8 w-8 items-center justify-center rounded border border-[#3A4242] text-[#A1A9A9]">2</div>
              <div className="mb-8 flex h-12 w-12 items-center justify-center rounded border border-[#CEFF8F]/30 bg-[#CEFF8F]/10">
                <CreditCard className="h-6 w-6 text-[#CEFF8F]" />
              </div>
              <h3 className="mb-4 text-2xl font-medium text-white">Paiement intégré instantané.</h3>
              <p className="mb-8 text-sm leading-relaxed text-[#A1A9A9]">
                Dès l’apposition de la signature, le module de paiement Stripe apparaît en overlay. L’acompte est sécurisé, le
                document scellé cryptographiquement et envoyé aux deux parties avec le reçu.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#CEFF8F]" />
                  <span className="text-[#F3F4F6]">Paiement par CB, prélèvement SEPA, Apple/Google Pay.</span>
                </li>
                <li className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#CEFF8F]" />
                  <span className="text-[#F3F4F6]">Engagement financier verrouillant juridiquement l’accord.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Faisceau de preuves — bento grid */}
      <section id="preuve" className="border-b border-[#3A4242] px-6 py-24 md:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16">
            <h2 className="text-[36px] font-semibold tracking-tight text-white sm:text-[48px]">
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
                  Chaque document signé est scellé. La moindre modification ultérieure d’un seul pixel invalide le hash. Le
                  document original et son certificat de preuve sont liés à vie.
                </p>
              </div>
            </div>

            {/* IP */}
            <div className="hover-lift col-span-1 flex min-h-[300px] flex-col justify-between rounded border border-[#3A4242] bg-[#222828] p-8 md:col-span-2">
              <Globe className="mb-8 h-8 w-8 text-[#A1A9A9]" />
              <div>
                <h4 className="mb-2 text-lg font-medium text-white">Traçabilité IP &amp; appareil</h4>
                <p className="text-xs text-[#A1A9A9]">
                  Enregistrement strict de l’adresse IP, du navigateur (User-Agent) et de l’OS au moment précis de l’interaction.
                </p>
              </div>
            </div>

            {/* OTP */}
            <div className="hover-lift col-span-1 rounded border border-[#3A4242] bg-[#222828] p-8 md:col-span-2">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded border border-[#3A4242] bg-[#191E1E]">
                  <Smartphone className="h-4 w-4 text-[#CEFF8F]" />
                </div>
                <h4 className="text-base font-medium text-white">Validation OTP SMS</h4>
              </div>
              <p className="text-xs text-[#A1A9A9]">
                Double facteur d’authentification requis avant signature. Le code à 6 chiffres lie le signataire à son numéro
                de téléphone personnel.
              </p>
            </div>

            {/* Horodatage */}
            <div className="hover-lift col-span-1 rounded border border-[#3A4242] bg-[#222828] p-8 md:col-span-2">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded border border-[#3A4242] bg-[#191E1E]">
                  <Clock className="h-4 w-4 text-[#CEFF8F]" />
                </div>
                <h4 className="text-base font-medium text-white">Horodatage eIDAS</h4>
              </div>
              <p className="text-xs text-[#A1A9A9]">
                Le temps n’est pas basé sur l’horloge locale, mais via un jeton d’horodatage qualifié universel garantissant la
                date et l’heure exactes.
              </p>
            </div>

            {/* Email */}
            <div className="hover-lift relative col-span-1 overflow-hidden rounded border border-[#3A4242] bg-[#222828] p-8 md:col-span-2">
              <div className="absolute -bottom-4 -right-4 opacity-5">
                <MailOpen className="h-32 w-32" />
              </div>
              <div className="relative z-10">
                <h4 className="mb-2 text-base font-medium text-white">Vérification de domaine</h4>
                <p className="text-xs text-[#A1A9A9]">
                  Le lien de signature n’est accessible que depuis la boîte mail du destinataire, établissant le premier niveau
                  du faisceau.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Regulatory ticker */}
      <section className="overflow-hidden bg-[#CEFF8F] py-8">
        <div className="flex animate-[pulse_10s_ease-in-out_infinite] flex-wrap justify-center gap-x-12 gap-y-3 text-[#191E1E] opacity-90">
          {[
            { icon: ShieldCheck, label: 'Conformité eIDAS' },
            { icon: Scale, label: 'Valeur probante européenne' },
            { icon: Archive, label: 'Archivage sécurisé 10 ans' },
            { icon: Lock, label: 'RGPD Compliant' },
          ].map((item) => (
            <span key={item.label} className="flex items-center gap-4 text-xl font-bold uppercase tracking-widest">
              <item.icon className="h-5 w-5" strokeWidth={2.5} /> {item.label}
            </span>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-b border-[#3A4242] px-6 py-24 md:px-12">
        <div className="mx-auto max-w-7xl">
          <h3 className="mb-12 text-center text-sm uppercase tracking-[0.2em] text-[#A1A9A9]">Conçu pour ceux qui clôturent</h3>
          <div className="grid gap-8 md:grid-cols-2">
            <div className="relative rounded border border-[#3A4242] bg-[#222828] p-8">
              <Quote className="absolute right-6 top-6 h-8 w-8 text-[#3A4242]" fill="currentColor" />
              <p className="mb-8 text-lg font-medium leading-relaxed text-[#F3F4F6]">
                « L’intégration du paiement directement dans le flux de signature a réduit ma perte de deals post-closing à
                zéro. Le client dit oui au téléphone, il signe et l’acompte est prélevé 30 secondes plus tard. »
              </p>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white">Julien M.</span>
                <span className="mt-1 text-[10px] uppercase tracking-wider text-[#A1A9A9]">Directeur Commercial, TechSaaS Co</span>
              </div>
            </div>
            <div className="relative rounded border border-[#3A4242] bg-[#222828] p-8">
              <Quote className="absolute right-6 top-6 h-8 w-8 text-[#3A4242]" fill="currentColor" />
              <p className="mb-8 text-lg font-medium leading-relaxed text-[#F3F4F6]">
                « En cas de litige, le dossier de preuve généré par CloseOS Sign est exhaustif. L’alliance de l’OTP, de l’IP et
                du hash cryptographique rend l’acte juridiquement blindé. »
              </p>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white">Sarah K.</span>
                <span className="mt-1 text-[10px] uppercase tracking-wider text-[#A1A9A9]">Avocate au Barreau de Paris, Droit du Numérique</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Waitlist */}
      <section id="attente" className="bg-noise relative px-6 py-32 md:px-12">
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <div className="mb-8 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded border border-[#CEFF8F] bg-[#CEFF8F]/10 shadow-[0_0_30px_rgba(206,255,143,0.1)]">
              <Rocket className="h-8 w-8 text-[#CEFF8F]" />
            </div>
          </div>
          <h2 className="mb-6 text-4xl font-semibold tracking-tight text-white">
            La bêta privée approche.<br />Réservez votre accès.
          </h2>
          <p className="mb-12 text-sm text-[#A1A9A9]">
            CloseOS Sign sera déployé progressivement aux agences et closers français. Inscrivez-vous pour être parmi les
            premiers à unifier signature et encaissement.
          </p>

          {submitted ? (
            <div className="mx-auto inline-flex items-center gap-2 rounded bg-[#CEFF8F]/15 px-5 py-3 text-sm font-medium text-[#CEFF8F]">
              <Check className="h-4 w-4" /> C’est noté ! On vous écrit dès l’ouverture.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mx-auto flex max-w-xl flex-col gap-3 sm:flex-row">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email-professionnel.fr"
                className="flex-1 rounded border border-[#3A4242] bg-[#191E1E] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-[#A1A9A9]/50 focus:border-[#CEFF8F] focus:ring-1 focus:ring-[#CEFF8F]"
              />
              <button
                type="submit"
                className="whitespace-nowrap rounded bg-[#CEFF8F] px-6 py-3 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC]"
              >
                Rejoindre la liste
              </button>
            </form>
          )}
          <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-[#A1A9A9]">
            <Lock className="h-3 w-3" fill="currentColor" /> <span>Vos données sont sécurisées et ne seront jamais revendues.</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#3A4242] bg-[#191E1E] px-6 pb-8 pt-16 md:px-12">
        <div className="mx-auto mb-16 grid max-w-7xl grid-cols-2 gap-12 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <div className="mb-6 flex items-center">
              <Logo className="h-5 w-5 text-[#A1A9A9]" />
              <span className="ml-2 text-sm font-semibold tracking-tight text-[#A1A9A9]">CloseOS Sign</span>
            </div>
            <p className="max-w-xs text-[11px] leading-relaxed text-[#A1A9A9]">
              Le standard de signature électronique pensé pour les cycles de vente rapides. Sécurisation juridique eIDAS
              couplée au paiement instantané.
            </p>
          </div>

          <div>
            <h5 className="mb-4 text-xs font-bold uppercase tracking-widest text-white">Produit</h5>
            <ul className="space-y-3">
              <li><a href="#concept" className="text-[11px] text-[#A1A9A9] transition-colors hover:text-white">Fonctionnalités Bêta</a></li>
              <li><a href="#concept" className="text-[11px] text-[#A1A9A9] transition-colors hover:text-white">Intégration Stripe</a></li>
              <li><a href="#preuve" className="text-[11px] text-[#A1A9A9] transition-colors hover:text-white">Preuve légale (Dossier eIDAS)</a></li>
              <li><a href="#attente" className="text-[11px] text-[#A1A9A9] transition-colors hover:text-white">API (Bientôt)</a></li>
            </ul>
          </div>

          <div>
            <h5 className="mb-4 text-xs font-bold uppercase tracking-widest text-white">Écosystème</h5>
            <ul className="space-y-3">
              <li><a href="/business" className="text-[11px] text-[#A1A9A9] transition-colors hover:text-white">CloseOS Business</a></li>
              <li><a href="/tarifs" className="text-[11px] text-[#A1A9A9] transition-colors hover:text-white">Tarifs</a></li>
              <li><a href="/fonctionnalites" className="text-[11px] text-[#A1A9A9] transition-colors hover:text-white">Fonctionnalités</a></li>
            </ul>
          </div>

          <div>
            <h5 className="mb-4 text-xs font-bold uppercase tracking-widest text-white">Légal</h5>
            <ul className="space-y-3">
              <li><a href="/cgv" className="text-[11px] text-[#A1A9A9] transition-colors hover:text-white">CGV &amp; CGU</a></li>
              <li><a href="/privacy-policy" className="text-[11px] text-[#A1A9A9] transition-colors hover:text-white">Politique de confidentialité</a></li>
              <li><a href="/legal" className="text-[11px] text-[#A1A9A9] transition-colors hover:text-white">Sécurité technique</a></li>
            </ul>
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between border-t border-[#3A4242] pt-8 md:flex-row">
          <span className="text-[10px] text-[#A1A9A9]">© {new Date().getFullYear()} CloseOS Technologies. Tous droits réservés. Construit en France.</span>
          <div className="mt-4 flex gap-4 text-[#A1A9A9] md:mt-0">
            <a href="#" className="hover:text-white"><Linkedin className="h-5 w-5" /></a>
            <a href="#" className="hover:text-white"><Twitter className="h-5 w-5" /></a>
          </div>
        </div>
      </footer>
    </div>
  );
}
