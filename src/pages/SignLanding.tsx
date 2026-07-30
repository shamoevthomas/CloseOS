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
  Bot,
} from 'lucide-react';
import { SignLogo } from '../components/SignLogo';
import SignContactModal from '../components/SignContactModal';
import SignLangToggle from '../components/SignLangToggle';
import { useSignLang } from '../contexts/SignLangContext';

/**
 * CloseOS Sign, landing (sign.closeos.fr)
 * DA Sign : lime #CEFF8F sur fond sombre #191E1E, mockups produit, bento-grid pour le faisceau de preuves.
 * Angle produit : Sign + Pay. Valeur réelle : le faisceau de preuves opposable + le certificat de preuve.
 * Le module est complet ; Sign est INCLUS avec CloseOS Business (pas d'inscription publique).
 */

type SignFaq = { q_fr: string; q_en: string; a_fr: string; a_en: string };

/**
 * Réponses calibrées pour la citation par les moteurs génératifs : 134 à 167 mots par
 * réponse, autonomes (compréhensibles hors contexte de page), et ouvrant sur une phrase
 * définitionnelle. Les versions courtes précédentes (~42 mots de médiane) étaient trop
 * maigres pour être extraites : un modèle allait citer une source plus développée.
 * Voir seo/GEO-ANALYSIS.md §4. Ne pas raccourcir sans mesurer.
 */
const SIGN_FAQ: SignFaq[] = [
  {
    q_fr: "Qu'est-ce que CloseOS Sign ?",
    q_en: 'What is CloseOS Sign?',
    a_fr: "CloseOS Sign est une solution de signature électronique française qui intègre l'encaissement du paiement. Là où un outil de signature classique s'arrête à la signature, CloseOS Sign réunit les deux actes : le signataire signe le contrat et règle au même endroit, dans le même flux, sans changer d'outil ni de page. Vous préparez vos contrats à l'avance sous forme de modèles réutilisables, vous y placez les champs à remplir, puis vous envoyez le document en un simple lien. Chaque signature s'accompagne d'un faisceau de preuves : journal d'événements horodaté, empreinte du document calculée côté serveur, vérification du signataire et certificat de preuve vérifiable en ligne. Sign fait partie de l'écosystème CloseOS, aux côtés de CloseOS Sales (le CRM du closer indépendant) et de CloseOS Business (le pilotage d'équipe de closing). Il s'utilise seul ou connecté aux deux autres produits.",
    a_en: "CloseOS Sign is a French e-signature solution with built-in payment collection. Where a classic e-signature tool stops at the signature, CloseOS Sign brings both actions together: the signer signs the contract and pays in the same place, in the same flow, without switching tools or pages. You prepare contracts ahead of time as reusable templates, place the fields to be filled in, then send the document as a single link. Every signature comes with an evidence bundle: a timestamped event log, a server-side document hash, signer verification and a proof certificate that can be checked online. Sign is part of the CloseOS ecosystem, alongside CloseOS Sales (the independent closer's CRM) and CloseOS Business (closing team management). It works on its own or connected to the other two products.",
  },
  {
    q_fr: 'Mes contrats signés ont-ils une valeur de preuve ?',
    q_en: 'Do my signed contracts have evidentiary value?',
    a_fr: "Oui. Chaque signature réalisée dans CloseOS Sign est accompagnée d'un faisceau de preuves conçu pour être opposable en cas de contestation. Ce faisceau réunit quatre éléments. D'abord un journal d'événements horodaté et inaltérable, qui enregistre chaque étape : ouverture du document, vérification du signataire, signature, paiement. Ensuite l'empreinte SHA-256 du document, calculée côté serveur sur les octets réellement reçus, ce qui permet de démontrer qu'il n'a pas été modifié après coup. Puis la méthode de vérification employée pour le signataire, avec son adresse IP et son horodatage. Enfin un certificat de preuve, généré une seule fois et figé définitivement, consultable et vérifiable en ligne par toute personne disposant de son identifiant. L'ensemble est conservé avec le contrat. CloseOS Sign est édité en France et hébergé dans l'Union européenne, en conformité avec le RGPD.",
    a_en: "Yes. Every signature made in CloseOS Sign comes with an evidence bundle designed to hold up if the contract is challenged. That bundle brings together four elements. First, a timestamped, tamper-proof event log recording each step: document opening, signer verification, signature, payment. Second, the document's SHA-256 hash, computed server-side on the bytes actually received, which proves it was not altered afterwards. Third, the verification method used for the signer, together with their IP address and timestamp. Finally, a proof certificate, generated once and permanently frozen, which anyone holding its identifier can view and verify online. Everything is stored with the contract. CloseOS Sign is published in France and hosted in the European Union, in compliance with GDPR.",
  },
  {
    q_fr: 'Puis-je faire signer ET encaisser en même temps ?',
    q_en: 'Can I get the contract signed AND collect payment at once?',
    a_fr: "Oui, et c'est précisément ce qui distingue CloseOS Sign des autres outils de signature électronique. Le paiement est intégré au parcours de signature via Stripe : au moment où votre client signe, il règle. Vous choisissez ce qui est encaissé — la totalité, un acompte, le solde d'un contrat déjà entamé, ou un abonnement récurrent. Vous décidez aussi du lien entre les deux actes : le paiement peut être exigé pour que le contrat soit finalisé, ou rester découplé de la signature si votre processus commercial le demande. Sur un contrat à plusieurs signataires, chacun peut avoir son propre montant à régler. L'intérêt est concret pour une activité de closing : le moment de la signature est le pic d'engagement du client, et faire basculer ce moment vers un autre outil de paiement, un autre onglet ou un virement à faire plus tard fait perdre des ventes.",
    a_en: "Yes, and this is exactly what sets CloseOS Sign apart from other e-signature tools. Payment is built into the signing flow through Stripe: the moment your client signs, they pay. You choose what is collected — the full amount, a deposit, the balance of a contract already under way, or a recurring subscription. You also decide how tightly the two are coupled: payment can be required for the contract to be finalized, or kept decoupled from the signature if your sales process calls for it. On a multi-signer contract, each signer can have their own amount to pay. The benefit is concrete for a closing business: signing is the client's peak of commitment, and pushing that moment into another payment tool, another tab or a bank transfer to be made later loses sales.",
  },
  {
    q_fr: 'Puis-je avoir plusieurs signataires sur un même contrat ?',
    q_en: 'Can I have multiple signers on one contract?',
    a_fr: "Oui. Un contrat CloseOS Sign accepte autant de signataires que nécessaire, et vous choisissez l'ordre dans lequel ils interviennent. En mode parallèle, tous reçoivent leur lien en même temps et peuvent signer sans s'attendre. En mode séquentiel, chacun n'est sollicité qu'une fois le précédent signataire passé, ce qui reproduit un circuit de validation classique. Chaque signataire dispose de son propre lien sécurisé, distinct des autres, avec sa propre méthode de vérification et, si vous le souhaitez, son propre montant à régler. Un signataire ne voit que ce qui le concerne : les informations réservées aux autres restent masquées. L'avancement est visible en temps réel depuis votre espace, contrat par contrat, avec le détail de qui a ouvert, vérifié son identité, signé ou payé. Les relances peuvent être envoyées à ceux qui n'ont pas encore signé, sans relancer les autres.",
    a_en: "Yes. A CloseOS Sign contract accepts as many signers as you need, and you choose the order in which they act. In parallel mode, everyone receives their link at the same time and can sign without waiting for the others. In sequential mode, each signer is only prompted once the previous one is done, reproducing a classic approval chain. Every signer gets their own secure link, separate from the others, with their own verification method and, if you wish, their own amount to pay. A signer only sees what concerns them: information reserved for others stays hidden. Progress is visible in real time from your workspace, contract by contract, showing who has opened, verified their identity, signed or paid. Reminders can be sent only to those who have not signed yet.",
  },
  {
    q_fr: "Comment l'identité du signataire est-elle vérifiée ?",
    q_en: "How is the signer's identity verified?",
    a_fr: "Avant de pouvoir signer, le signataire confirme son identité au moyen d'un code à usage unique. Vous choisissez la méthode contrat par contrat : code envoyé par email, code envoyé par SMS, ou les deux cumulés lorsque l'enjeu le justifie. Le code n'est valable que pour ce signataire et pour ce contrat. Le système bloque les tentatives répétées : après plusieurs codes erronés, l'accès est verrouillé, ce qui empêche une attaque par force brute sur un lien intercepté. Vous pouvez également restreindre l'accès à une liste d'adresses email autorisées, de sorte qu'un lien transféré à un tiers ne permette pas de signer. La méthode de vérification utilisée, l'horodatage et l'adresse IP du signataire sont enregistrés dans le journal d'événements et repris dans le certificat de preuve, où ils restent consultables après la signature.",
    a_en: "Before they can sign, the signer confirms their identity with a one-time code. You choose the method contract by contract: a code sent by email, a code sent by SMS, or both combined when the stakes justify it. The code is valid only for that signer and that contract. The system blocks repeated attempts: after several wrong codes, access is locked, which prevents a brute-force attack on an intercepted link. You can also restrict access to a list of authorized email addresses, so that a link forwarded to someone else does not allow signing. The verification method used, the timestamp and the signer's IP address are recorded in the event log and carried into the proof certificate, where they remain available after signing.",
  },
  {
    q_fr: 'Combien coûte CloseOS Sign, et est-il inclus avec CloseOS Business ?',
    q_en: 'How much does CloseOS Sign cost, and is it included with CloseOS Business?',
    a_fr: "CloseOS Sign démarre à 9 € par mois en annuel, après 14 jours d'essai gratuit sans engagement. Une carte bancaire est demandée à l'inscription, mais aucun prélèvement n'a lieu pendant l'essai et vous pouvez annuler à tout moment. Il n'y a qu'une seule formule : elle donne accès à l'ensemble des fonctionnalités, sans palier ni option à débloquer. Le multi-signataire, la vérification par email et SMS, le paiement intégré, les modèles de contrat réutilisables, les espaces dédiés aux membres de votre équipe et le certificat de preuve sont compris dès le premier euro. L'abonnement est porté par le propriétaire du compte, pas facturé par utilisateur. Si vous êtes déjà client de CloseOS Business, l'accès à Sign est inclus dans votre abonnement, sans supplément et avec la même connexion : vos contrats et votre CRM vivent dans le même compte. À l'inverse, CloseOS Sign s'utilise parfaitement seul, sans avoir à adopter le reste de l'écosystème.",
    a_en: "CloseOS Sign starts at €9 per month billed annually, after a 14-day free trial with no commitment. A credit card is requested at sign-up, but nothing is charged during the trial and you can cancel at any time. There is a single plan: it unlocks every feature, with no tiers and no add-ons to buy. Multi-signer contracts, email and SMS verification, built-in payment, reusable contract templates, dedicated workspaces for your team members and the proof certificate are all included from the first euro. The subscription is held by the account owner rather than billed per user. If you are already a CloseOS Business customer, Sign access is included in your subscription at no extra cost and with the same login: your contracts and your CRM live in the same account. Conversely, CloseOS Sign works perfectly on its own, without adopting the rest of the ecosystem.",
  },
];

function SignFaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded border border-[#3A4242] bg-[#222828] overflow-hidden transition-colors hover:border-[#4A5252]">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
      >
        <span className="text-base font-medium text-white">{q}</span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-[#CEFF8F] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-6 pb-6">
          <p className="whitespace-pre-line text-sm leading-relaxed text-[#A1A9A9]">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function SignLanding() {
  const { lang } = useSignLang();
  const [showContact, setShowContact] = useState(false);
  useEffect(() => {
    document.title = lang === 'fr'
      ? 'CloseOS Sign | Signez le contrat, encaissez le paiement'
      : 'CloseOS Sign | Sign the contract, collect the payment';
    document.querySelector('meta[name="description"]')?.setAttribute(
      'content',
      lang === 'fr'
        ? "CloseOS Sign : la signature électronique qui encaisse. Faites signer le contrat ET encaissez le paiement (acompte, solde ou abonnement) dans le même geste, avec un faisceau de preuves opposable (email, OTP SMS, horodatage, IP, hash SHA-256) et un certificat de preuve vérifiable."
        : "CloseOS Sign: the e-signature that collects payment. Get the contract signed AND collect the payment (deposit, balance or subscription) in a single motion, with an enforceable evidence bundle (email, SMS OTP, timestamp, IP, SHA-256 hash) and a verifiable proof certificate.",
    );
    // La racine du sous-domaine redirige (301) vers /sign : le canonical doit viser l'URL finale.
    document.getElementById('canonical')?.setAttribute('href', 'https://sign.closeos.fr/sign');
    document.getElementById('og-url')?.setAttribute('content', 'https://sign.closeos.fr/sign');
    document.getElementById('og-title')?.setAttribute('content', lang === 'fr'
      ? 'CloseOS Sign, Signez le contrat, encaissez le paiement'
      : 'CloseOS Sign, Sign the contract, collect the payment');
    document.getElementById('og-description')?.setAttribute('content', lang === 'fr'
      ? "Sign + Pay : faites signer le contrat et encaissez le paiement dans le même geste, avec un certificat de preuve vérifiable."
      : "Sign + Pay: get the contract signed and collect the payment in a single motion, with a verifiable proof certificate.");
    // Visuel de partage propre à Sign (DA sombre + lime) — sans ça, Sign hérite de l'image de l'écosystème
    document.getElementById('og-image')?.setAttribute('content', 'https://sign.closeos.fr/og-sign.jpg');
    document.getElementById('tw-image')?.setAttribute('content', 'https://sign.closeos.fr/og-sign.jpg');

    // Données structurées : la page affiche déjà le produit et 6 questions-réponses (SIGN_FAQ),
    // mais rien n'était balisé — c'est ce que citent les moteurs génératifs.
    document.querySelectorAll('script[data-sign-ld]').forEach((el) => el.remove());
    const addLd = (data: unknown) => {
      const el = document.createElement('script');
      el.type = 'application/ld+json';
      el.setAttribute('data-sign-ld', 'true');
      el.textContent = JSON.stringify(data);
      document.head.appendChild(el);
    };
    addLd({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'CloseOS Sign',
      url: 'https://sign.closeos.fr/sign',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      inLanguage: ['fr', 'en'],
      description: lang === 'fr'
        ? "Signature électronique avec paiement intégré : le client signe le contrat et règle dans le même flux, avec vérification d'identité, faisceau de preuves horodaté et certificat de preuve vérifiable."
        : 'E-signature with built-in payment: the client signs the contract and pays in the same flow, with identity verification, a timestamped evidence bundle and a verifiable proof certificate.',
      offers: {
        '@type': 'Offer',
        price: '9',
        priceCurrency: 'EUR',
        availability: 'https://schema.org/InStock',
        description: lang === 'fr' ? 'À partir de 9 €/mois, inclus avec CloseOS Business.' : 'From €9/month, included with CloseOS Business.',
      },
      publisher: { '@type': 'Organization', name: 'CloseOS', url: 'https://www.closeos.fr' },
    });
    addLd({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: SIGN_FAQ.map((f) => ({
        '@type': 'Question',
        name: lang === 'fr' ? f.q_fr : f.q_en,
        acceptedAnswer: { '@type': 'Answer', text: lang === 'fr' ? f.a_fr : f.a_en },
      })),
    });
    addLd({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'CloseOS', item: 'https://www.closeos.fr' },
        { '@type': 'ListItem', position: 2, name: 'CloseOS Sign', item: 'https://sign.closeos.fr/sign' },
      ],
    });
  }, [lang]);

  // Bulle chatbot CloseOS Assistant (chargement différé 5s), comme sur les LP Sales et Business
  useEffect(() => {
    let chatbotScript: HTMLScriptElement | null = null;
    const chatbotTimer = setTimeout(() => {
      chatbotScript = document.createElement('script');
      chatbotScript.src = '/chatbot-widget.js';
      chatbotScript.setAttribute('data-chatbot-id', 'acb35233-a6de-4738-9ba0-7e25c82c2a61');
      chatbotScript.setAttribute('data-supabase-url', 'https://mkxcircbzcsjamslijde.supabase.co');
      chatbotScript.setAttribute('data-supabase-key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1reGNpcmNiemNzamFtc2xpamRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MjM0MDAsImV4cCI6MjA4NzQ5OTQwMH0.9-abq1tEFsmjfRkLJjrkXlG3z-9o2HKYjyp5eBIl178');
      chatbotScript.setAttribute('data-lang', lang);
      document.body.appendChild(chatbotScript);
    }, 5000);
    return () => {
      clearTimeout(chatbotTimer);
      if (chatbotScript && document.body.contains(chatbotScript)) {
        document.body.removeChild(chatbotScript);
      }
      document.getElementById('chatbot-widget-container')?.remove();
    };
  }, [lang]);

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
          <span className="hidden sm:inline">{lang === 'fr' ? 'Signez le contrat et encaissez le paiement dans le même geste.' : 'Sign the contract and collect the payment in a single motion.'}</span>
          <span className="truncate sm:hidden">{lang === 'fr' ? 'Signez et encaissez d’un seul geste.' : 'Sign and collect in one motion.'}</span>
        </div>
        <a href="/sign/abonnement" className="flex shrink-0 items-center gap-1 transition-opacity hover:opacity-70">
          <span className="hidden sm:inline">{lang === 'fr' ? 'Essayer gratuitement' : 'Try for free'}</span><span className="sm:hidden">{lang === 'fr' ? 'Essayer' : 'Try it'}</span> <ArrowRight className="h-3 w-3" strokeWidth={2.5} />
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
            <a href="#multi" className="transition-colors hover:text-[#F3F4F6]">{lang === 'fr' ? 'Multi-signataire' : 'Multi-signer'}</a>
            <a href="#modeles" className="transition-colors hover:text-[#F3F4F6]">{lang === 'fr' ? 'Modèles' : 'Templates'}</a>
            <a href="#assistant-ia" className="transition-colors hover:text-[#F3F4F6]">{lang === 'fr' ? 'Assistant IA' : 'AI Assistant'}</a>
            <a href="#preuve" className="transition-colors hover:text-[#F3F4F6]">{lang === 'fr' ? 'Faisceau de preuves' : 'Evidence bundle'}</a>
            <a href="#securite" className="transition-colors hover:text-[#F3F4F6]">{lang === 'fr' ? 'Sécurité' : 'Security'}</a>
            <a href="#faq" className="transition-colors hover:text-[#F3F4F6]">FAQ</a>
          </nav>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <SignLangToggle className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold uppercase tracking-wider text-[#F3F4F6]/80 hover:text-[#CEFF8F] transition-colors" />
          <a href="/sign/login" className="text-sm font-medium transition-colors hover:text-[#F3F4F6]">{lang === 'fr' ? 'Connexion' : 'Log in'}</a>
          <a href="/sign/abonnement" className="whitespace-nowrap rounded bg-[#CEFF8F] px-4 py-2 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC] sm:px-5">
            {lang === 'fr' ? 'Essai gratuit' : 'Free trial'}
          </a>
        </div>
      </header>

      {/* <main> : delimite le contenu principal pour les extracteurs (crawlers IA, lecteurs d'ecran). Sans lui, rien ne distingue le texte de navigation du contenu. */}
      <main>

      {/* Hero */}
      <section className="bg-noise relative overflow-hidden border-b border-[#3A4242] px-4 pb-20 pt-16 sm:px-6 sm:pb-32 sm:pt-24 md:px-12">
        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Copy */}
          <div className="space-y-6 sm:space-y-8">
            <div className="inline-flex items-center gap-2 rounded border border-[#3A4242] bg-[#222828] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#CEFF8F]">
              <BadgeCheck className="h-3.5 w-3.5" /> {lang === 'fr' ? '14 jours d’essai gratuit · sans engagement' : '14-day free trial · no commitment'}
            </div>
            <h1 className="text-[30px] font-semibold leading-[1.08] tracking-tight text-white sm:text-[40px] sm:leading-[1.05] lg:text-[52px]">
              {lang === 'fr' ? (
                <>
                  Signez le contrat,<br />
                  <span className="text-[#CEFF8F]">encaissez le paiement.</span><br />
                  Dans le même geste.
                </>
              ) : (
                <>
                  Sign the contract,<br />
                  <span className="text-[#CEFF8F]">collect the payment.</span><br />
                  In a single motion.
                </>
              )}
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-[#A1A9A9]">
              {lang === 'fr'
                ? 'La signature électronique qui encaisse. Ne laissez plus un deal refroidir entre la signature et le virement : CloseOS Sign lie la validation du contrat à son paiement sur un seul écran, avec un faisceau de preuves opposable et un certificat vérifiable.'
                : 'The e-signature that collects payment. Never let a deal cool off between the signature and the transfer: CloseOS Sign ties the contract validation to its payment on a single screen, with an enforceable evidence bundle and a verifiable certificate.'}
            </p>
            <div className="flex flex-col gap-4 pt-4 sm:flex-row">
              <a href="/sign/abonnement" className="flex items-center justify-center gap-2 rounded bg-[#CEFF8F] px-8 py-3 text-center font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC]">
                {lang === 'fr' ? 'Démarrer l’essai gratuit' : 'Start the free trial'} <ArrowRight className="h-4 w-4" />
              </a>
              <a href="#preuve" className="rounded border border-[#3A4242] bg-transparent px-8 py-3 text-center font-medium text-white transition-colors hover:border-[#A1A9A9]">
                {lang === 'fr' ? 'Voir le faisceau de preuves' : 'See the evidence bundle'}
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
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#CEFF8F]">{lang === 'fr' ? 'Zone de signature' : 'Signature zone'}</span>
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
                <p className="mt-0.5 text-[10px] uppercase text-[#A1A9A9]">{lang === 'fr' ? 'Identité vérifiée' : 'Identity verified'}</p>
              </div>
              <div className="wire-b" />
            </div>

            {/* Pay action */}
            <div className="absolute right-[5%] top-[45%] z-40 w-[220px] rounded border border-[#CEFF8F] bg-[#CEFF8F] p-4 shadow-[0_0_40px_rgba(206,255,143,0.15)]">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-bold text-[#191E1E]">{lang === 'fr' ? 'Paiement sécurisé' : 'Secure payment'}</span>
                <CheckCircle2 className="h-4 w-4 text-[#191E1E]" fill="currentColor" stroke="#CEFF8F" />
              </div>
              <div className="mb-3 text-[10px] text-[#191E1E]/80">{lang === 'fr' ? 'Paiement lié au contrat #4092' : 'Payment tied to contract #4092'}</div>
              <button className="w-full rounded bg-[#191E1E] py-2 text-xs font-bold text-[#CEFF8F]">
                {lang === 'fr' ? 'Payer 1 500 € & Signer' : 'Pay €1,500 & Sign'}
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
              {lang === 'fr' ? 'Paiements propulsés par Stripe · Module de l’écosystème CloseOS' : 'Payments powered by Stripe · Part of the CloseOS ecosystem'}
            </span>
            <div className="flex flex-wrap justify-center gap-8 opacity-50 grayscale md:gap-16">
              <span className="text-xl font-bold tracking-tighter">Stripe.</span>
              <span className="text-lg font-bold">CloseOS Business</span>
              <span className="text-xl font-bold tracking-wide">{lang === 'fr' ? 'RGPD' : 'GDPR'}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Concept : Sign + Pay */}
      <section id="concept" className="relative border-b border-[#3A4242] px-4 py-16 sm:px-6 sm:py-24 md:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-16">
            <div className="mb-4 inline-block rounded border border-[#3A4242] bg-[#222828] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#CEFF8F]">
              {lang === 'fr' ? 'Le flux unique' : 'The single flow'}
            </div>
            <h2 className="text-[26px] font-semibold tracking-tight text-white sm:text-4xl">
              {lang === 'fr' ? 'Le moment de la signature est votre pic émotionnel. Ne le brisez pas.' : 'The moment of signing is your emotional peak. Do not break it.'}
            </h2>
          </div>

          <div className="grid overflow-hidden rounded border border-[#3A4242] lg:grid-cols-2">
            {/* Signature */}
            <div className="relative bg-[#222828] p-7 sm:p-12">
              <div className="absolute right-6 top-6 flex h-8 w-8 items-center justify-center rounded border border-[#3A4242] text-[#A1A9A9]">1</div>
              <div className="mb-8 flex h-12 w-12 items-center justify-center rounded border border-[#3A4242] bg-[#191E1E]">
                <FileSignature className="h-6 w-6 text-[#F3F4F6]" />
              </div>
              <h3 className="mb-4 text-2xl font-medium text-white">{lang === 'fr' ? 'Signature fluide, sans friction.' : 'Smooth, frictionless signing.'}</h3>
              <p className="mb-8 text-sm leading-relaxed text-[#A1A9A9]">
                {lang === 'fr'
                  ? 'Composez le contrat depuis un modèle, une feuille blanche ou un PDF importé. Posez les champs en glisser-déposer. Votre client ouvre le lien sur mobile ou desktop, aucune création de compte requise, et signe en un clic.'
                  : 'Build the contract from a template, a blank page or an imported PDF. Drop the fields in with drag-and-drop. Your client opens the link on mobile or desktop, no account required, and signs in one click.'}
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#CEFF8F]" />
                  <span className="text-[#F3F4F6]">{lang === 'fr' ? 'Modèles, import PDF et éditeur en glisser-déposer.' : 'Templates, PDF import and drag-and-drop editor.'}</span>
                </li>
                <li className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#CEFF8F]" />
                  <span className="text-[#F3F4F6]">{lang === 'fr' ? 'Champs pré-remplis depuis votre carnet de contacts.' : 'Fields pre-filled from your contact book.'}</span>
                </li>
                <li className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#CEFF8F]" />
                  <span className="text-[#F3F4F6]">{lang === 'fr' ? '100% responsive, lecture claire sur mobile.' : '100% responsive, clear reading on mobile.'}</span>
                </li>
              </ul>
            </div>

            {/* Payment */}
            <div className="relative border-t border-[#3A4242] bg-[#1D2323] p-7 sm:p-12 lg:border-l lg:border-t-0">
              <div className="absolute right-6 top-6 flex h-8 w-8 items-center justify-center rounded border border-[#3A4242] text-[#A1A9A9]">2</div>
              <div className="mb-8 flex h-12 w-12 items-center justify-center rounded border border-[#CEFF8F]/30 bg-[#CEFF8F]/10">
                <CreditCard className="h-6 w-6 text-[#CEFF8F]" />
              </div>
              <h3 className="mb-4 text-2xl font-medium text-white">{lang === 'fr' ? '« Payé + signé », d’un seul geste.' : '“Paid + signed”, in a single motion.'}</h3>
              <p className="mb-8 text-sm leading-relaxed text-[#A1A9A9]">
                {lang === 'fr' ? (
                  <>
                    Activez le paiement sur le contrat : le signataire règle le paiement (acompte, solde ou abonnement) pour valider. Via Stripe Connect,
                    l’argent arrive <span className="text-[#F3F4F6]">directement sur votre compte</span>. Le document est ensuite scellé et
                    envoyé aux deux parties.
                  </>
                ) : (
                  <>
                    Enable payment on the contract: the signer settles the payment (deposit, balance or subscription) to validate. Through Stripe Connect,
                    the money lands <span className="text-[#F3F4F6]">directly in your account</span>. The document is then sealed and
                    sent to both parties.
                  </>
                )}
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#CEFF8F]" />
                  <span className="text-[#F3F4F6]">{lang === 'fr' ? 'Paiement par carte sécurisé via Stripe, sur votre compte.' : 'Secure card payment via Stripe, into your account.'}</span>
                </li>
                <li className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#CEFF8F]" />
                  <span className="text-[#F3F4F6]">{lang === 'fr' ? 'Paiement assignable à un signataire précis, ou à tous.' : 'Payment assignable to a specific signer, or to all.'}</span>
                </li>
                <li className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#CEFF8F]" />
                  <span className="text-[#F3F4F6]">{lang === 'fr' ? 'Engagement financier qui verrouille l’accord.' : 'A financial commitment that locks in the deal.'}</span>
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
              {lang === 'fr' ? 'Plusieurs parties' : 'Multiple parties'}
            </div>
            <h2 className="text-[28px] font-semibold tracking-tight text-white sm:text-[36px] lg:text-[44px]">
              {lang === 'fr' ? (
                <>
                  Un, deux, dix signataires.<br />
                  <span className="text-[#A1A9A9]">Chacun sa vérification, chacun son rôle.</span>
                </>
              ) : (
                <>
                  One, two, ten signers.<br />
                  <span className="text-[#A1A9A9]">Each with their own verification, each with their own role.</span>
                </>
              )}
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="hover-lift rounded border border-[#3A4242] bg-[#222828] p-8">
              <Users className="mb-6 h-8 w-8 text-[#CEFF8F]" />
              <h4 className="mb-2 text-lg font-medium text-white">{lang === 'fr' ? 'Plusieurs signataires' : 'Multiple signers'}</h4>
              <p className="text-sm text-[#A1A9A9]">
                {lang === 'fr'
                  ? 'Ajoutez autant de signataires que nécessaire. Chacun reçoit son propre lien sécurisé et ses propres champs, avec une couleur dédiée dans l’éditeur.'
                  : 'Add as many signers as you need. Each one gets their own secure link and their own fields, with a dedicated color in the editor.'}
              </p>
            </div>
            <div className="hover-lift rounded border border-[#3A4242] bg-[#222828] p-8">
              <GitBranch className="mb-6 h-8 w-8 text-[#CEFF8F]" />
              <h4 className="mb-2 text-lg font-medium text-white">{lang === 'fr' ? 'Parallèle ou séquentiel' : 'Parallel or sequential'}</h4>
              <p className="text-sm text-[#A1A9A9]">
                {lang === 'fr'
                  ? 'Tout le monde signe quand il veut, ou dans un ordre imposé (1 → 2 → 3) : le signataire suivant n’est sollicité qu’une fois le précédent passé.'
                  : 'Everyone signs whenever they want, or in an enforced order (1 → 2 → 3): the next signer is only prompted once the previous one is done.'}
              </p>
            </div>
            <div className="hover-lift rounded border border-[#3A4242] bg-[#222828] p-8">
              <Fingerprint className="mb-6 h-8 w-8 text-[#CEFF8F]" />
              <h4 className="mb-2 text-lg font-medium text-white">{lang === 'fr' ? 'Vérification par signataire' : 'Per-signer verification'}</h4>
              <p className="text-sm text-[#A1A9A9]">
                {lang === 'fr'
                  ? 'Chaque signataire a sa propre liste de vérification (email / SMS), et le paiement peut être demandé à un signataire précis, indépendamment de sa vérification.'
                  : 'Each signer has their own verification checklist (email / SMS), and payment can be requested from a specific signer, independently of their verification.'}
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
              {lang === 'fr' ? 'Contrats réutilisables' : 'Reusable contracts'}
            </div>
            <h2 className="text-[28px] font-semibold tracking-tight text-white sm:text-[36px] lg:text-[44px]">
              {lang === 'fr' ? (
                <>
                  Un modèle, mille signatures.<br />
                  <span className="text-[#A1A9A9]">Un espace par membre de votre équipe.</span>
                </>
              ) : (
                <>
                  One template, a thousand signatures.<br />
                  <span className="text-[#A1A9A9]">A workspace for every member of your team.</span>
                </>
              )}
            </h2>
            <p className="mt-5 text-base leading-relaxed text-[#A1A9A9]">
              {lang === 'fr'
                ? 'Créez un contrat-type une seule fois. Chaque envoi génère une copie figée et indépendante, avec son propre certificat de preuve, modifier le modèle n’altère jamais les documents déjà signés.'
                : 'Create a standard contract once. Every send generates a frozen, independent copy, with its own proof certificate, editing the template never alters documents that have already been signed.'}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="hover-lift rounded border border-[#3A4242] bg-[#222828] p-8">
              <Files className="mb-6 h-8 w-8 text-[#CEFF8F]" />
              <h4 className="mb-2 text-lg font-medium text-white">{lang === 'fr' ? 'Modèle réutilisable' : 'Reusable template'}</h4>
              <p className="text-sm text-[#A1A9A9]">
                {lang === 'fr'
                  ? 'Le même contrat envoyé à l’infini. Chaque signature crée une instance scellée à part, le modèle, lui, ne se consomme jamais et reste modifiable.'
                  : 'The same contract sent endlessly. Each signature creates a separate, sealed instance, the template itself is never consumed and stays editable.'}
              </p>
            </div>
            <div className="hover-lift rounded border border-[#3A4242] bg-[#222828] p-8">
              <UserCheck className="mb-6 h-8 w-8 text-[#CEFF8F]" />
              <h4 className="mb-2 text-lg font-medium text-white">{lang === 'fr' ? 'Un espace par membre' : 'A workspace per member'}</h4>
              <p className="text-sm text-[#A1A9A9]">
                {lang === 'fr'
                  ? 'Donnez à chaque commercial, closer ou collaborateur son propre accès sécurisé (code email + appareil de confiance) pour générer ses liens et suivre ses signatures, sans jamais voir celles des autres.'
                  : 'Give every sales rep, closer or team member their own secure access (email code + trusted device) to generate their links and track their signatures, without ever seeing anyone else’s.'}
              </p>
            </div>
            <div className="hover-lift rounded border border-[#3A4242] bg-[#222828] p-8">
              <LayoutDashboard className="mb-6 h-8 w-8 text-[#CEFF8F]" />
              <h4 className="mb-2 text-lg font-medium text-white">{lang === 'fr' ? 'Suivi & attribution' : 'Tracking & attribution'}</h4>
              <p className="text-sm text-[#A1A9A9]">
                {lang === 'fr'
                  ? 'Qui a généré quoi, combien de contrats signés, en attente ou expirés. Liens valables 7 jours et révocation d’un accès en un clic, l’historique reste intact.'
                  : 'Who generated what, how many contracts signed, pending or expired. Links valid for 7 days and access revoked in one click, the history stays intact.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Assistant IA, connecteur MCP */}
      <section id="assistant-ia" className="border-b border-[#3A4242] px-4 py-16 sm:px-6 sm:py-24 md:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 max-w-2xl sm:mb-16">
            <div className="mb-4 inline-flex items-center gap-2 rounded border border-[#3A4242] bg-[#222828] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#CEFF8F]">
              <Bot className="h-3.5 w-3.5" /> {lang === 'fr' ? 'Nouveau · Assistant IA' : 'New · AI Assistant'}
            </div>
            <h2 className="text-[28px] font-semibold tracking-tight text-white sm:text-[36px] lg:text-[44px]">
              {lang === 'fr' ? (
                <>
                  Pilotez votre équipe Sign<br />
                  <span className="text-[#A1A9A9]">depuis Claude ou ChatGPT.</span>
                </>
              ) : (
                <>
                  Run your Sign team<br />
                  <span className="text-[#A1A9A9]">from Claude or ChatGPT.</span>
                </>
              )}
            </h2>
            <p className="mt-5 text-base leading-relaxed text-[#A1A9A9]">
              {lang === 'fr'
                ? 'Un vrai connecteur MCP (Model Context Protocol), activable en un clic depuis vos Paramètres : demandez à votre assistant IA de lister vos modèles, voir votre équipe, ou assigner un contrat à un collaborateur, il le fait, directement dans CloseOS Sign.'
                : 'A real MCP (Model Context Protocol) connector, activated in one click from your Settings: ask your AI assistant to list your templates, see your team, or assign a contract to a team member, it does it, directly inside CloseOS Sign.'}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="hover-lift rounded border border-[#3A4242] bg-[#222828] p-8">
              <KeyRound className="mb-6 h-8 w-8 text-[#CEFF8F]" />
              <h4 className="mb-2 text-lg font-medium text-white">{lang === 'fr' ? 'Clé personnelle par compte' : 'Personal per-account key'}</h4>
              <p className="text-sm text-[#A1A9A9]">
                {lang === 'fr'
                  ? "Activez, copiez ou révoquez votre clé de connexion depuis Paramètres → Assistant IA. Compatible Claude, ChatGPT et tout client MCP standard."
                  : 'Activate, copy or revoke your connection key from Settings → AI Assistant. Works with Claude, ChatGPT and any standard MCP client.'}
              </p>
            </div>
            <div className="hover-lift rounded border border-[#3A4242] bg-[#222828] p-8">
              <Users className="mb-6 h-8 w-8 text-[#CEFF8F]" />
              <h4 className="mb-2 text-lg font-medium text-white">{lang === 'fr' ? 'Modèles & équipe en un message' : 'Templates & team in one message'}</h4>
              <p className="text-sm text-[#A1A9A9]">
                {lang === 'fr'
                  ? 'Demandez à votre assistant la liste de vos contrats-types et de vos collaborateurs, en langage naturel.'
                  : "Ask your assistant for the list of your contract templates and your team members, in plain language."}
              </p>
            </div>
            <div className="hover-lift rounded border border-[#3A4242] bg-[#222828] p-8">
              <GitBranch className="mb-6 h-8 w-8 text-[#CEFF8F]" />
              <h4 className="mb-2 text-lg font-medium text-white">{lang === 'fr' ? 'Assignation à la volée' : 'On-the-fly assignment'}</h4>
              <p className="text-sm text-[#A1A9A9]">
                {lang === 'fr'
                  ? "Ajoutez ou retirez l'accès d'un membre à un modèle, sans ouvrir l'interface, votre assistant s'en charge."
                  : "Grant or remove a team member's access to a template without opening the interface, your assistant handles it."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Faisceau de preuves, bento grid */}
      <section id="preuve" className="border-b border-[#3A4242] px-4 py-16 sm:px-6 sm:py-24 md:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 sm:mb-16">
            <h2 className="text-[28px] font-semibold tracking-tight text-white sm:text-[36px] lg:text-[48px]">
              {lang === 'fr' ? (
                <>
                  Pas juste une signature.<br />
                  <span className="text-[#A1A9A9]">Un faisceau de preuves inattaquable.</span>
                </>
              ) : (
                <>
                  Not just a signature.<br />
                  <span className="text-[#A1A9A9]">An airtight evidence bundle.</span>
                </>
              )}
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
            {/* Hash */}
            <div className="hover-lift col-span-1 flex min-h-[300px] flex-col justify-between rounded border border-[#3A4242] bg-[#222828] p-8 md:col-span-4">
              <div className="flex items-start justify-between">
                <Fingerprint className="h-9 w-9 text-[#F3F4F6]" />
                <span className="rounded border border-[#3A4242] bg-[#191E1E] px-2 py-1 text-[10px] uppercase">{lang === 'fr' ? 'Cryptographie' : 'Cryptography'}</span>
              </div>
              <div>
                <h4 className="mb-2 text-xl font-medium text-white">{lang === 'fr' ? 'Hash cryptographique unique (SHA-256)' : 'Unique cryptographic hash (SHA-256)'}</h4>
                <p className="max-w-md text-sm text-[#A1A9A9]">
                  {lang === 'fr'
                    ? 'Le document scellé est haché côté serveur sur les octets réellement reçus. La moindre modification ultérieure invalide le hash. Document et certificat de preuve sont liés à vie.'
                    : 'The sealed document is hashed server-side on the bytes actually received. The slightest later change invalidates the hash. Document and proof certificate are bound for life.'}
                </p>
              </div>
            </div>

            {/* IP */}
            <div className="hover-lift col-span-1 flex min-h-[300px] flex-col justify-between rounded border border-[#3A4242] bg-[#222828] p-8 md:col-span-2">
              <Globe className="mb-8 h-8 w-8 text-[#A1A9A9]" />
              <div>
                <h4 className="mb-2 text-lg font-medium text-white">{lang === 'fr' ? 'Traçabilité IP & appareil' : 'IP & device traceability'}</h4>
                <p className="text-xs text-[#A1A9A9]">
                  {lang === 'fr'
                    ? 'Adresse IP, navigateur et appareil enregistrés côté serveur au moment précis de chaque interaction.'
                    : 'IP address, browser and device recorded server-side at the exact moment of each interaction.'}
                </p>
              </div>
            </div>

            {/* OTP */}
            <div className="hover-lift col-span-1 rounded border border-[#3A4242] bg-[#222828] p-8 md:col-span-2">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded border border-[#3A4242] bg-[#191E1E]">
                  <Smartphone className="h-4 w-4 text-[#CEFF8F]" />
                </div>
                <h4 className="text-base font-medium text-white">{lang === 'fr' ? 'Vérification email & SMS' : 'Email & SMS verification'}</h4>
              </div>
              <p className="text-xs text-[#A1A9A9]">
                {lang === 'fr'
                  ? 'Code à 6 chiffres par email, par SMS, ou les deux, avant la signature. Blocage anti-fraude après plusieurs tentatives échouées.'
                  : '6-digit code by email, by SMS, or both, before signing. Anti-fraud lockout after several failed attempts.'}
              </p>
            </div>

            {/* Horodatage */}
            <div className="hover-lift col-span-1 rounded border border-[#3A4242] bg-[#222828] p-8 md:col-span-2">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded border border-[#3A4242] bg-[#191E1E]">
                  <Clock className="h-4 w-4 text-[#CEFF8F]" />
                </div>
                <h4 className="text-base font-medium text-white">{lang === 'fr' ? 'Horodatage serveur' : 'Server timestamp'}</h4>
              </div>
              <p className="text-xs text-[#A1A9A9]">
                {lang === 'fr'
                  ? 'Chaque étape est horodatée côté serveur (UTC), pas sur l’horloge locale du signataire, pour une chronologie fiable.'
                  : 'Every step is timestamped server-side (UTC), not on the signer’s local clock, for a reliable chronology.'}
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
                <h4 className="mb-2 text-base font-medium text-white">{lang === 'fr' ? 'Journal d’événements inviolable' : 'Tamper-proof event log'}</h4>
                <p className="text-xs text-[#A1A9A9]">
                  {lang === 'fr'
                    ? 'Création, envois, ouvertures, vérifications, paiement, scellement : tout est consigné dans un journal append-only, source unique de vérité.'
                    : 'Creation, sends, opens, verifications, payment, sealing: everything is recorded in an append-only log, the single source of truth.'}
                </p>
              </div>
            </div>
          </div>

          {/* Certificat de preuve */}
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-6">
            <div className="hover-lift col-span-1 flex flex-col justify-between rounded border border-[#3A4242] bg-[#1D2323] p-8 md:col-span-3">
              <BadgeCheck className="mb-6 h-9 w-9 text-[#CEFF8F]" />
              <div>
                <h4 className="mb-2 text-xl font-medium text-white">{lang === 'fr' ? 'Certificat de preuve, joint au document' : 'Proof certificate, attached to the document'}</h4>
                <p className="text-sm text-[#A1A9A9]">
                  {lang === 'fr'
                    ? 'À la complétion, un certificat est généré une fois puis figé : identités, méthode de vérification, timeline, IP, preuve de paiement, hashs. Il voyage avec le document signé.'
                    : 'On completion, a certificate is generated once and then frozen: identities, verification method, timeline, IP, proof of payment, hashes. It travels with the signed document.'}
                </p>
              </div>
            </div>
            <div className="hover-lift col-span-1 flex flex-col justify-between rounded border border-[#3A4242] bg-[#1D2323] p-8 md:col-span-3">
              <ScanLine className="mb-6 h-9 w-9 text-[#CEFF8F]" />
              <div>
                <h4 className="mb-2 text-xl font-medium text-white">{lang === 'fr' ? 'Vérification publique' : 'Public verification'}</h4>
                <p className="text-sm text-[#A1A9A9]">
                  {lang === 'fr'
                    ? 'Une page de vérification permet à n’importe qui de contrôler l’authenticité d’un document et de son certificat, les coordonnées sensibles restant masquées hors des parties concernées.'
                    : 'A verification page lets anyone check the authenticity of a document and its certificate, with sensitive contact details kept hidden from anyone outside the parties involved.'}
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
            { icon: ShieldCheck, label: lang === 'fr' ? 'Faisceau de preuves opposable' : 'Enforceable evidence bundle' },
            { icon: Clock, label: lang === 'fr' ? 'Horodatage serveur (UTC)' : 'Server timestamp (UTC)' },
            { icon: Archive, label: lang === 'fr' ? 'Conservation 5 ans + legal hold' : '5-year retention + legal hold' },
            { icon: Lock, label: lang === 'fr' ? 'RGPD Compliant' : 'GDPR compliant' },
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
              {lang === 'fr' ? 'Sécurité' : 'Security'}
            </div>
            <h2 className="text-[28px] font-semibold tracking-tight text-white sm:text-[36px] lg:text-[44px]">
              {lang === 'fr' ? (
                <>
                  Vos contrats et vos paiements,<br />
                  <span className="text-[#A1A9A9]">protégés à chaque couche.</span>
                </>
              ) : (
                <>
                  Your contracts and your payments,<br />
                  <span className="text-[#A1A9A9]">protected at every layer.</span>
                </>
              )}
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="hover-lift rounded border border-[#3A4242] bg-[#222828] p-8">
              <Smartphone className="mb-6 h-8 w-8 text-[#CEFF8F]" />
              <h4 className="mb-2 text-lg font-medium text-white">{lang === 'fr' ? 'Double authentification' : 'Two-factor authentication'}</h4>
              <p className="text-sm text-[#A1A9A9]">
                {lang === 'fr'
                  ? 'Connexion vérifiée sur chaque nouvel appareil (code email), appareil de confiance 7 jours, et alerte de connexion.'
                  : 'Login verified on every new device (email code), 7-day trusted device, and login alert.'}
              </p>
            </div>
            <div className="hover-lift rounded border border-[#3A4242] bg-[#222828] p-8">
              <KeyRound className="mb-6 h-8 w-8 text-[#CEFF8F]" />
              <h4 className="mb-2 text-lg font-medium text-white">{lang === 'fr' ? 'Accès cloisonné' : 'Partitioned access'}</h4>
              <p className="text-sm text-[#A1A9A9]">
                {lang === 'fr'
                  ? 'Données isolées par compte (sécurité au niveau des lignes), accès signataire limité à son seul document via un lien à usage contrôlé.'
                  : 'Data isolated per account (row-level security), signer access limited to their own document via a usage-controlled link.'}
              </p>
            </div>
            <div className="hover-lift rounded border border-[#3A4242] bg-[#222828] p-8">
              <Lock className="mb-6 h-8 w-8 text-[#CEFF8F]" />
              <h4 className="mb-2 text-lg font-medium text-white">{lang === 'fr' ? 'Conforme RGPD' : 'GDPR compliant'}</h4>
              <p className="text-sm text-[#A1A9A9]">
                {lang === 'fr'
                  ? 'Conservation maîtrisée (5 ans + legal hold), export de vos données à la demande, journal de preuves conservé avec le contrat.'
                  : 'Controlled retention (5 years + legal hold), export of your data on request, evidence log kept with the contract.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-b border-[#3A4242] px-4 py-16 sm:px-6 sm:py-24 md:px-12">
        <div className="mx-auto max-w-3xl">
          <div className="mb-12 text-center sm:mb-16">
            <div className="mb-4 inline-block rounded border border-[#3A4242] bg-[#222828] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#CEFF8F]">
              FAQ
            </div>
            <h2 className="text-[28px] font-semibold tracking-tight text-white sm:text-[36px] lg:text-[44px]">
              {lang === 'fr' ? 'Questions fréquentes' : 'Frequently asked questions'}
            </h2>
          </div>
          <div className="space-y-3">
            {SIGN_FAQ.map((f, i) => (
              <SignFaqItem key={i} q={lang === 'fr' ? f.q_fr : f.q_en} a={lang === 'fr' ? f.a_fr : f.a_en} />
            ))}
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
            {lang === 'fr' ? (
              <>Essayez CloseOS Sign,<br />14 jours gratuits.</>
            ) : (
              <>Try CloseOS Sign,<br />14 days free.</>
            )}
          </h2>
          <p className="mb-12 text-sm text-[#A1A9A9]">
            {lang === 'fr'
              ? 'Signez et encaissez dès aujourd’hui. Sans engagement, annulable à tout moment. Déjà client CloseOS Business ? Votre accès Sign est inclus.'
              : 'Sign and collect starting today. No commitment, cancel anytime. Already a CloseOS Business customer? Your Sign access is included.'}
          </p>

          <div className="mx-auto flex max-w-xl flex-col justify-center gap-3 sm:flex-row">
            <a href="/sign/abonnement" className="flex items-center justify-center gap-2 whitespace-nowrap rounded bg-[#CEFF8F] px-8 py-3 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC]">
              {lang === 'fr' ? 'Démarrer l’essai gratuit' : 'Start the free trial'} <ArrowRight className="h-4 w-4" />
            </a>
            <a href="/sign/login" className="flex items-center justify-center gap-2 whitespace-nowrap rounded border border-[#3A4242] px-8 py-3 text-sm font-medium text-white transition-colors hover:border-[#A1A9A9]">
              {lang === 'fr' ? 'Se connecter' : 'Log in'}
            </a>
          </div>
          <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-[#A1A9A9]">
            <Lock className="h-3 w-3" fill="currentColor" /> <span>{lang === 'fr' ? 'Signature électronique conforme RGPD, vos données ne sont jamais revendues.' : 'GDPR-compliant e-signature, your data is never resold.'}</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      </main>
      <footer className="border-t border-[#3A4242] bg-[#191E1E] px-4 pb-8 pt-16 sm:px-6 md:px-12">
        <div className="mx-auto mb-16 grid max-w-7xl grid-cols-2 gap-12 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <div className="mb-6 flex items-center">
              <SignLogo className="text-sm" muted />
            </div>
            <p className="max-w-xs text-[11px] leading-relaxed text-[#A1A9A9]">
              {lang === 'fr'
                ? 'La signature électronique pensée pour les cycles de vente rapides. Sécurisation du contrat couplée au paiement instantané.'
                : 'The e-signature built for fast sales cycles. Contract security coupled with instant payment.'}
            </p>
          </div>

          <div>
            <h5 className="mb-4 text-xs font-bold uppercase tracking-widest text-white">{lang === 'fr' ? 'Produit' : 'Product'}</h5>
            <ul className="space-y-3">
              <li><a href="#concept" className="text-[11px] text-[#A1A9A9] transition-colors hover:text-white">Sign + Pay</a></li>
              <li><a href="#multi" className="text-[11px] text-[#A1A9A9] transition-colors hover:text-white">{lang === 'fr' ? 'Multi-signataire' : 'Multi-signer'}</a></li>
              <li><a href="#modeles" className="text-[11px] text-[#A1A9A9] transition-colors hover:text-white">{lang === 'fr' ? 'Modèles réutilisables' : 'Reusable templates'}</a></li>
              <li><a href="#preuve" className="text-[11px] text-[#A1A9A9] transition-colors hover:text-white">{lang === 'fr' ? 'Faisceau de preuves & certificat' : 'Evidence bundle & certificate'}</a></li>
              <li><a href="#securite" className="text-[11px] text-[#A1A9A9] transition-colors hover:text-white">{lang === 'fr' ? 'Sécurité' : 'Security'}</a></li>
            </ul>
          </div>

          <div>
            <h5 className="mb-4 text-xs font-bold uppercase tracking-widest text-white">{lang === 'fr' ? 'Écosystème' : 'Ecosystem'}</h5>
            <ul className="space-y-3">
              <li><a href="/business" className="text-[11px] text-[#A1A9A9] transition-colors hover:text-white">CloseOS Business</a></li>
              <li><a href="/tarifs" className="text-[11px] text-[#A1A9A9] transition-colors hover:text-white">{lang === 'fr' ? 'Tarifs' : 'Pricing'}</a></li>
              <li><a href="/sign/login" className="text-[11px] text-[#A1A9A9] transition-colors hover:text-white">{lang === 'fr' ? 'Connexion' : 'Log in'}</a></li>
            </ul>
          </div>

          <div>
            <h5 className="mb-4 text-xs font-bold uppercase tracking-widest text-white">{lang === 'fr' ? 'Légal' : 'Legal'}</h5>
            <ul className="space-y-3">
              <li><a href="/sign/cgv" className="text-[11px] text-[#A1A9A9] transition-colors hover:text-white">{lang === 'fr' ? 'CGV & CGU' : 'Terms of sale & use'}</a></li>
              <li><a href="/sign/confidentialite" className="text-[11px] text-[#A1A9A9] transition-colors hover:text-white">{lang === 'fr' ? 'Politique de confidentialité' : 'Privacy policy'}</a></li>
              <li><a href="/sign/securite" className="text-[11px] text-[#A1A9A9] transition-colors hover:text-white">{lang === 'fr' ? 'Sécurité technique' : 'Technical security'}</a></li>
            </ul>
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between border-t border-[#3A4242] pt-8 md:flex-row">
          <span className="text-[10px] text-[#A1A9A9]">© {new Date().getFullYear()} CloseOS. {lang === 'fr' ? 'Tous droits réservés.' : 'All rights reserved.'}</span>
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
