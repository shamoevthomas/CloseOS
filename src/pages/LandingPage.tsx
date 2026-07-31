import { Link, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { motion } from 'motion/react'

import { PricingComparisonTable } from '../components/PricingComparisonTable';
import {
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  Zap,
  BarChart3,
  ChevronRight,
  XCircle,
  MessageSquare,
  FileText,
  Smartphone,
  BrainCircuit,
  CalendarCheck,
  LayoutDashboard,
  Phone,
  Star,
  ShieldCheck,
  Database,
  Users,
  Building2,
  Sheet,
  Clock,
  X,
  Menu,
  ChevronDown,
  Globe,
  Quote,
  Paperclip,
  Send,
  Loader2,
  Mail,
  Handshake,
  Gift,
  Layers,
  Check,
  CheckCircle,
  AlarmClock,
} from 'lucide-react'
import { salesTranslations, detectSalesLang } from './landingPageI18n'
import type { SalesLang } from './landingPageI18n'

/* ────────────────────────────────────────────────────────────────
   DOODLES, petits dessins line-art faits main (style Tally),
   déclinés dans la DA Sales (bleu ciel + slate). Purement décoratifs :
   pointer-events-none, aria-hidden, masqués sur très petit écran.
   ──────────────────────────────────────────────────────────────── */
type DoodleProps = { className?: string }

/* Souligné ondulé (sous un mot clé) */
function DoodleSquiggle({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 240 18" fill="none" className={className} aria-hidden="true">
      <path d="M4 11C24 2 44 2 64 8s40 8 60 1 42-8 60-2 44 6 52 2" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* Cercle griffonné autour d'un mot (boucle ouverte qui déborde) */
function DoodleCircle({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 260 110" fill="none" className={className} aria-hidden="true">
      <path d="M78 16C40 22 12 40 15 63c4 27 66 34 128 27 47-5 104-20 106-44C251 25 190 10 128 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/* Bulle de dialogue avec petits traits (comme le "Yes!" de Tally) */
function DoodleBubble({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 96 78" fill="none" className={className} aria-hidden="true">
      <path d="M10 14c0-6 5-10 13-10h50c8 0 13 4 13 10v30c0 6-5 10-13 10H44L26 68l3-14h-6c-8 0-13-4-13-10z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M26 26h44M26 36h30" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/* Petit visage esquissé */
function DoodleFace({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 84 84" fill="none" className={className} aria-hidden="true">
      <path d="M42 6C22 6 8 22 8 42s14 36 34 36 34-16 34-36S62 6 42 6z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M28 36c2-3 8-3 10 0M46 36c2-3 8-3 10 0" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M30 52c6 8 18 8 24 0" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/* Avion en papier avec traînée pointillée */
function DoodlePlane({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 130 96" fill="none" className={className} aria-hidden="true">
      <path d="M6 90C34 66 66 26 118 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="1 9" opacity="0.55" />
      <path d="M118 8L92 44 82 30 64 40z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M82 30l10 14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* Flèche courbe façon "clique ici" */
function DoodleArrow({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 120 96" fill="none" className={className} aria-hidden="true">
      <path d="M12 12c46 4 82 30 86 68" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M74 66l24 16 6-26" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* Étincelle 4 branches */
function DoodleSparkle({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <path d="M16 3c1 7 5 11 12 13-7 2-11 6-12 13-1-7-5-11-12-13 7-2 11-6 12-13z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  )
}

/* Petite croix / plus */
function DoodleCross({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/* Tirets de mouvement en diagonale */
function DoodleDashes({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 60 40" fill="none" className={className} aria-hidden="true">
      <path d="M4 30L18 12M22 34L36 16M40 30L52 14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/* Éclair */
function DoodleBolt({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 28 38" fill="none" className={className} aria-hidden="true">
      <path d="M17 3 5 22h8l-2 13 12-20h-8l2-12z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* Cible / bullseye */
function DoodleTarget({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <path d="M24 5C13 6 6 15 6 24s8 18 18 19 18-9 18-19S35 6 24 5z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 15c-5 0-9 4-9 9s4 9 9 9 9-4 9-9-4-9-9-9z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 21a3 3 0 100 6 3 3 0 000-6z" fill="currentColor" />
    </svg>
  )
}

/* Fusée */
function DoodleRocket({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 40 48" fill="none" className={className} aria-hidden="true">
      <path d="M20 3c7 6 9 16 8 24l-5 5h-6l-5-5c-1-8 1-18 8-24z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 15a3 3 0 100 6 3 3 0 000-6z" stroke="currentColor" strokeWidth="2.5" />
      <path d="M13 28l-5 6 3 2M27 28l5 6-3 2M17 33c1 4 3 8 3 8s2-4 3-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* Pièce € */
function DoodleCoin({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <path d="M20 4C11 4 4 11 4 20s7 16 16 16 16-7 16-16S29 4 20 4z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M26 14c-2-2-5-2-7 0-3 3-3 9 0 12 2 2 5 2 7 0M13 18h9M13 23h7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

/* Courbe qui monte (perf) */
function DoodleChartUp({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 46 40" fill="none" className={className} aria-hidden="true">
      <path d="M8 5v29h32" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M13 28l7-9 6 4 10-13" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M31 10h6v6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* Cœur */
function DoodleHeart({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 40 36" fill="none" className={className} aria-hidden="true">
      <path d="M20 33S5 23 5 13c0-5 4-8 8-8 3 0 5 2 7 4 2-2 4-4 7-4 4 0 8 3 8 8 0 10-15 20-15 20z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* Étoile 5 branches */
function DoodleStar5({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <path d="M20 4l5 11 12 1-9 8 3 12-11-7-11 7 3-12-9-8 12-1z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* Éclat "pow" (rayons) */
function DoodleBurst({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <path d="M20 4v7M20 29v7M4 20h7M29 20h7M9 9l5 5M26 26l5 5M31 9l-5 5M14 26l-5 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

/* Check / validé */
function DoodleCheck({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 34 30" fill="none" className={className} aria-hidden="true">
      <path d="M4 16l8 9L30 5" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* Ampoule (idée) */
function DoodleBulb({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 36 40" fill="none" className={className} aria-hidden="true">
      <path d="M18 6c-6 0-10 4-10 10 0 4 2 6 4 8v4h12v-4c2-2 4-4 4-8 0-6-4-10-10-10z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 32h10M15 36h6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M18 1v3M5 8l2 2M31 8l-2 2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

/* Trophée */
function DoodleTrophy({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 36 42" fill="none" className={className} aria-hidden="true">
      <path d="M9 5h18v7c0 6-4 10-9 10s-9-4-9-10zM9 8H5c0 5 3 8 6 8M27 8h4c0 5-3 8-6 8M18 22v7M13 34h10l1 5H12z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* Horloge */
function DoodleClock({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <path d="M20 5C12 5 5 12 5 20s7 15 15 15 15-7 15-15S28 5 20 5z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M20 11v9l6 4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* Flèche courbe (autre sens) */
function DoodleArrowDown({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <path d="M33 7C17 7 8 17 8 33" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M2 25l6 9 9-3" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* Zigzag énergique */
function DoodleZigzag({ className = '' }: DoodleProps) {
  return (
    <svg viewBox="0 0 64 22" fill="none" className={className} aria-hidden="true">
      <path d="M3 11l9-7 8 12 8-12 8 12 8-12 8 12 5-6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ─── Constants ─── */
const INTEGRATIONS = [
  { name: 'HubSpot', logo: '/hubspot.webp' },
  { name: 'Pipedrive', logo: '/pipedrive.webp' },
  { name: 'GoHighLevel', logo: '/ghl.webp' },
  { name: 'Airtable', logo: '/airtable.webp' },
  { name: 'Systeme.io', logo: '/systemeio.webp' },
  { name: 'iClosed', logo: '/iclosed.webp' },
  { name: 'Google Calendar', logo: '/gcalendar.webp' },
  { name: 'Stripe', logo: '/stripe.webp' },
  { name: 'Calendly', logo: '/calendly.webp' },
  { name: 'Zapier', logo: '/zapier.webp' },
  { name: 'Make', logo: '/make.webp' },
  { name: 'n8n', logo: '/n8n.webp' },
  { name: 'CSV', logo: '/logocsv.webp' },
];

/* ─── Integrations Marquee, logo cards, two rows (Business style) ─── */
function IntegrationsMarquee() {
  const topRow = INTEGRATIONS.filter((_, i) => i % 2 === 0);
  const bottomRow = INTEGRATIONS.filter((_, i) => i % 2 === 1);

  const IntegrationCard = ({ integration }: { integration: { name: string; logo: string } }) => (
    <div className="flex items-center gap-2.5 px-4 py-2.5 bg-white rounded-xl border border-slate-200/80 shadow-sm min-w-[130px]">
      <img src={integration.logo} alt={integration.name} className="h-5 w-auto object-contain" loading="lazy" width={80} height={20} />
      <span className="text-xs font-semibold text-slate-900 whitespace-nowrap">{integration.name}</span>
    </div>
  );

  return (
    <div className="relative overflow-hidden space-y-3 mt-8">
      <div className="absolute inset-y-0 left-0 w-16 sm:w-24 bg-gradient-to-r from-[#f4f2f1] to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-16 sm:w-24 bg-gradient-to-l from-[#f4f2f1] to-transparent z-10 pointer-events-none" />
      <div className="flex int-marquee-left w-max">
        {[...Array(4)].map((_, dup) => (
          <div key={dup} className="flex gap-4 pr-4 shrink-0">
            {topRow.map((integration) => (
              <IntegrationCard key={`${dup}-${integration.name}`} integration={integration} />
            ))}
          </div>
        ))}
      </div>
      <div className="flex int-marquee-right w-max">
        {[...Array(4)].map((_, dup) => (
          <div key={dup} className="flex gap-4 pr-4 shrink-0">
            {bottomRow.map((integration) => (
              <IntegrationCard key={`${dup}-${integration.name}`} integration={integration} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── FAQ Accordion, Glass ─── */
function FAQItem({ question, children }: { question: string, children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`glass-card rounded-2xl transition-all duration-500 ${isOpen ? 'shadow-[0_0_30px_rgba(2,132,199,0.10)]' : ''}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-6 p-7 text-left group"
      >
        <span className="font-extrabold text-lg text-slate-900 leading-snug" style={{ fontFamily: "'Manrope', sans-serif" }}>
          {question}
        </span>
        <div className={`shrink-0 p-2.5 rounded-full transition-all duration-400 ${isOpen ? 'bg-sky-500 rotate-90' : 'bg-slate-100 group-hover:bg-slate-100'}`}>
          <ChevronRight className={`h-4 w-4 transition-colors duration-300 ${isOpen ? 'text-white' : 'text-slate-500'}`} strokeWidth={1.5} />
        </div>
      </button>
      <div className={`grid transition-all duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className="px-7 pb-7 text-slate-500 leading-[1.7] text-[0.94rem]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Sales Partner Section ─── */
const SALES_AUDIENCE_RANGES = ['0 - 50', '50 - 200', '200 - 500', '500 - 1K', '1K - 5K', '5K - 10K', '10K+']
const SALES_PLATFORM_OPTIONS = ['Instagram', 'LinkedIn', 'YouTube', 'TikTok', 'X / Twitter', 'Site web / Blog', 'Newsletter', 'Podcast', 'Autre']

const SALES_PHONE_CODES = [
  { code: '+33', flag: '\u{1F1EB}\u{1F1F7}', name: 'France' },
  { code: '+32', flag: '\u{1F1E7}\u{1F1EA}', name: 'Belgique' },
  { code: '+41', flag: '\u{1F1E8}\u{1F1ED}', name: 'Suisse' },
  { code: '+352', flag: '\u{1F1F1}\u{1F1FA}', name: 'Luxembourg' },
  { code: '+1', flag: '\u{1F1FA}\u{1F1F8}', name: '\u00C9tats-Unis' },
  { code: '+44', flag: '\u{1F1EC}\u{1F1E7}', name: 'Royaume-Uni' },
  { code: '+49', flag: '\u{1F1E9}\u{1F1EA}', name: 'Allemagne' },
  { code: '+34', flag: '\u{1F1EA}\u{1F1F8}', name: 'Espagne' },
  { code: '+39', flag: '\u{1F1EE}\u{1F1F9}', name: 'Italie' },
  { code: '+212', flag: '\u{1F1F2}\u{1F1E6}', name: 'Maroc' },
  { code: '+216', flag: '\u{1F1F9}\u{1F1F3}', name: 'Tunisie' },
  { code: '+213', flag: '\u{1F1E9}\u{1F1FF}', name: 'Alg\u00E9rie' },
  { code: '+225', flag: '\u{1F1E8}\u{1F1EE}', name: "C\u00F4te d'Ivoire" },
  { code: '+221', flag: '\u{1F1F8}\u{1F1F3}', name: 'S\u00E9n\u00E9gal' },
  { code: '+237', flag: '\u{1F1E8}\u{1F1F2}', name: 'Cameroun' },
]

function SalesPhoneInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [code, setCode] = useState('+33')
  const [local, setLocal] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const handleLocal = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 15)
    const parts: string[] = []
    for (let i = 0; i < digits.length; i += 2) parts.push(digits.slice(i, i + 2))
    const formatted = parts.join(' ')
    setLocal(formatted)
    onChange(digits ? `${code} ${formatted}` : '')
  }

  const currentFlag = SALES_PHONE_CODES.find(c => c.code === code)?.flag || '\u{1F30D}'

  return (
    <div className="relative flex items-center rounded-xl bg-slate-100" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-1 shrink-0 pl-3 pr-1.5 py-2.5 hover:bg-slate-100 rounded-l-xl transition-colors">
        <span className="text-base">{currentFlag}</span>
        <span className="text-xs text-slate-500 font-medium">{code}</span>
        <ChevronDown className="h-3 w-3 text-slate-500" />
      </button>
      <div className="w-px h-5 bg-slate-100 shrink-0" />
      <input type="tel" value={local} onChange={e => handleLocal(e.target.value)} placeholder="6 12 34 56 78" className="flex-1 min-w-0 bg-transparent border-none py-2.5 px-3 text-sm text-slate-900 focus:ring-0 focus:outline-none font-medium placeholder:text-slate-400" />
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-64 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          {SALES_PHONE_CODES.map((c, i) => (
            <button key={`${c.code}-${i}`} type="button" onClick={() => { setCode(c.code); setLocal(''); onChange(''); setOpen(false) }} className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-100 transition-colors ${code === c.code ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-500'}`}>
              <span className="text-base">{c.flag}</span>
              <span className="flex-1 truncate">{c.name}</span>
              <span className="text-xs text-slate-500 font-medium">{c.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SalesPartnerSection({ t }: { t: any }) {
  const [showModal, setShowModal] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [isSubscriber, setIsSubscriber] = useState(false)
  const [whatsapp, setWhatsapp] = useState('')
  const [activity, setActivity] = useState('')
  const [audienceIdx, setAudienceIdx] = useState(1)
  const [platforms, setPlatforms] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim() || !whatsapp.trim()) return
    setSending(true)
    try {
      const platformsList = platforms.length > 0 ? platforms.join(', ') : 'Non renseigné'
      const message = `Prénom : ${firstName}\nNom : ${lastName}\nAbonné CloseOS : ${isSubscriber ? 'Oui' : 'Non'}\nWhatsApp : ${whatsapp}\nActivité : ${activity || 'Non renseigné'}\nTaille d'audience : ${SALES_AUDIENCE_RANGES[audienceIdx]}\nPrésence : ${platformsList}\n\nNotes :\n${notes || '—'}`
      await fetch('/api/email?action=contact-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${firstName} ${lastName}`,
          email: 'ambassador-form@closeos.fr',
          isSubscriber,
          subject: '[Ambassadeur Sales] Candidature',
          message,
        }),
      })
      setSent(true)
    } catch {
      // silent
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <motion.section id="partners" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.8 }} className="py-32 relative border-t border-slate-200 overflow-hidden">
        <div className="pointer-events-none select-none absolute inset-0 hidden lg:block" aria-hidden="true">
          <DoodleRocket className="absolute left-[4%] top-[14%] w-11 text-sky-500 -rotate-6" />
          <DoodleStar5 className="absolute left-[9%] top-[40%] w-5 text-sky-400" />
          <DoodleTrophy className="absolute left-[3%] top-[64%] w-11 text-slate-800/80" />
          <DoodleDashes className="absolute left-[5%] top-[88%] w-11 text-slate-300 rotate-6" />
          <DoodleBurst className="absolute right-[6%] top-[14%] w-6 text-sky-400" />
          <DoodleBubble className="absolute right-[3%] top-[38%] w-14 text-slate-800/80 rotate-6" />
          <DoodleHeart className="absolute right-[9%] top-[64%] w-6 text-sky-400" />
          <DoodleCross className="absolute right-[7%] top-[88%] w-3.5 text-slate-300" />
        </div>
        <div className="mx-auto max-w-5xl px-6 relative z-10">
          <div className="text-center mb-16 space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-4">
              <Handshake className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-700">{t.partners_badge}</span>
            </div>
            <h2 className="text-[2.5rem] sm:text-[3.5rem] font-extrabold text-slate-900 leading-[0.95]" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.04em' }}>{t.partners_title}</h2>
            <p className="text-slate-500 mt-5 text-lg">{t.partners_subtitle}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Partner card */}
            <div className="glass-card rounded-2xl p-8 flex flex-col">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 w-fit mb-6">
                <Layers className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-bold text-slate-700">{t.partners_integrate_title}</span>
              </div>
              <p className="text-slate-500 mb-6">{t.partners_integrate_desc}</p>
              <ul className="space-y-3 mb-8 flex-1">
                {t.partners_integrate_items.map((item: string, i: number) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-sky-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-700">{item}</span>
                  </li>
                ))}
              </ul>
              <a
                href="/book/6512796c" target="_blank" rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 rounded-full bg-sky-600 text-white h-12 font-bold text-sm hover:bg-sky-500 transition-all active:scale-[0.98]"
              >
                {t.partners_integrate_cta}
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>

            {/* Ambassador card */}
            <div className="glass-card rounded-2xl p-8 flex flex-col">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 w-fit mb-6">
                <Gift className="h-4 w-4 text-sky-600" />
                <span className="text-sm font-bold text-sky-600">{t.partners_ambassador_title}</span>
              </div>
              <p className="text-slate-500 mb-6">{t.partners_ambassador_desc}</p>
              <ul className="space-y-3 mb-8 flex-1">
                {t.partners_ambassador_items.map((item: string, i: number) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-sky-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-700">{item}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => { setShowModal(true); setSent(false) }}
                className="w-full flex items-center justify-center gap-2 rounded-full bg-sky-600 text-white h-12 font-bold text-sm hover:bg-sky-500 transition-all active:scale-[0.98]"
              >
                {t.partners_ambassador_cta}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Ambassador modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-sky-500/10 flex items-center justify-center">
                    <Gift className="h-5 w-5 text-sky-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900" style={{ fontFamily: "'Manrope', sans-serif" }}>Devenir Ambassadeur</h3>
                </div>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
                  <X className="h-5 w-5 text-slate-500" />
                </button>
              </div>

              {sent ? (
                <div className="text-center py-10">
                  <div className="w-16 h-16 rounded-full bg-sky-500/10 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="h-8 w-8 text-sky-600" />
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 mb-2">Candidature envoyée !</h4>
                  <p className="text-slate-500 text-sm">Nous reviendrons vers vous rapidement.</p>
                  <button onClick={() => setShowModal(false)} className="mt-6 px-6 py-2.5 rounded-full bg-sky-600 text-white text-sm font-bold hover:bg-sky-500 transition-all">
                    Fermer
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Prénom *</label>
                      <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jean" className="w-full px-4 py-2.5 rounded-xl bg-slate-100 border-none text-sm text-slate-900 focus:ring-2 ring-slate-200 font-medium placeholder:text-slate-400" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Nom *</label>
                      <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Dupont" className="w-full px-4 py-2.5 rounded-xl bg-slate-100 border-none text-sm text-slate-900 focus:ring-2 ring-slate-200 font-medium placeholder:text-slate-400" />
                    </div>
                  </div>

                  <div>
                    <button onClick={() => setIsSubscriber(!isSubscriber)} className="flex items-center gap-3 w-full rounded-xl bg-slate-100 px-4 py-3 transition-colors hover:bg-slate-100">
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isSubscriber ? 'bg-sky-500 border-sky-500' : 'border-slate-300'}`}>
                        {isSubscriber && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <span className="text-sm font-medium text-slate-700">Je suis abonné(e) CloseOS</span>
                    </button>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">WhatsApp *</label>
                    <SalesPhoneInput value={whatsapp} onChange={setWhatsapp} />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Ce que vous faites</label>
                    <input type="text" value={activity} onChange={e => setActivity(e.target.value)} placeholder="Coach, formateur, créateur de contenu..." className="w-full px-4 py-2.5 rounded-xl bg-slate-100 border-none text-sm text-slate-900 focus:ring-2 ring-slate-200 font-medium placeholder:text-slate-400" />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Taille de votre audience</label>
                    <div className="px-2">
                      <input type="range" min={0} max={SALES_AUDIENCE_RANGES.length - 1} value={audienceIdx} onChange={e => setAudienceIdx(Number(e.target.value))} className="w-full h-2 rounded-full appearance-none bg-slate-100 accent-sky-500 cursor-pointer" />
                      <div className="flex justify-between mt-1.5">
                        {SALES_AUDIENCE_RANGES.map((r, i) => (
                          <span key={i} className={`text-[9px] font-bold ${i === audienceIdx ? 'text-slate-900' : 'text-slate-400'}`}>{r}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Où vous trouver ? (Insta, LinkedIn, site vitrine…)</label>
                    <input type="text" value={platforms.join(', ')} onChange={e => setPlatforms(e.target.value ? [e.target.value] : [])} placeholder="https://instagram.com/votre-compte, https://linkedin.com/in/..." className="w-full px-4 py-2.5 rounded-xl bg-slate-100 border-none text-sm text-slate-900 focus:ring-2 ring-slate-200 font-medium placeholder:text-slate-400" />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Notes</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Parlez-nous de vous, de votre audience, de vos idées..." rows={3} className="w-full px-4 py-2.5 rounded-xl bg-slate-100 border-none text-sm text-slate-900 focus:ring-2 ring-slate-200 font-medium resize-none placeholder:text-slate-400" />
                  </div>

                  <button onClick={handleSubmit} disabled={sending || !firstName.trim() || !lastName.trim() || !whatsapp.trim()} className="w-full flex items-center justify-center gap-2 rounded-full bg-sky-600 text-white h-12 font-bold text-sm hover:bg-sky-500 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                      <>
                        <Send className="h-4 w-4" />
                        Envoyer ma candidature
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ─── Motion Variants ─── */
const containerVariants: any = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants: any = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] } }
};

/* ════════════════════════════════════════════════
   CONTACT MODAL
   ════════════════════════════════════════════════ */
const SalesContactModal = ({ open, onClose, t }: { open: boolean; onClose: () => void; t: any }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isSubscriber, setIsSubscriber] = useState(false);
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const fileRef = useRef<HTMLInputElement>(null);

  const categories = [
    { value: 'Bug', label: t.contact_category_bug },
    { value: 'Feature', label: t.contact_category_feature },
    { value: 'Partnership', label: t.contact_category_partnership },
    { value: 'Help', label: t.contact_category_help },
    { value: 'Billing', label: t.contact_category_billing },
    { value: 'Other', label: t.contact_category_other },
  ];

  const resetForm = () => {
    setName(''); setEmail(''); setIsSubscriber(false); setCategory(''); setSubject(''); setMessage(''); setAttachment(null); setStatus('idle');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    try {
      let attachmentBase64: string | undefined;
      let attachmentType: string | undefined;
      let attachmentName: string | undefined;
      if (attachment) {
        attachmentName = attachment.name;
        attachmentType = attachment.type;
        const buffer = await attachment.arrayBuffer();
        attachmentBase64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      }
      const res = await fetch('/api/contact-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, isSubscriber, subject: `[${categories.find(c => c.value === category)?.label || category}]: ${subject}`, message, attachmentBase64, attachmentName, attachmentType }),
      });
      if (!res.ok) throw new Error();
      setStatus('success');
      setTimeout(() => { resetForm(); onClose(); }, 2000);
    } catch {
      setStatus('error');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-sky-600 border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">{t.contact_title}</h2>
          <button onClick={() => { resetForm(); onClose(); }} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="size-5 text-slate-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t.contact_name}</label>
            <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder={t.contact_name_placeholder}
              className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t.contact_email}</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder={t.contact_email_placeholder}
              className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isSubscriber} onChange={e => setIsSubscriber(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 bg-slate-100 text-sky-600 focus:ring-sky-500" />
            <span className="text-sm text-slate-700">{t.contact_subscriber}</span>
          </label>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t.contact_category}</label>
            <select required value={category} onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none">
              <option value="" disabled className="text-slate-500">{t.contact_category_placeholder}</option>
              {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t.contact_subject}</label>
            <input type="text" required value={subject} onChange={e => setSubject(e.target.value)} placeholder={t.contact_subject_placeholder}
              className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t.contact_message}</label>
            <textarea required rows={5} value={message} onChange={e => setMessage(e.target.value)} placeholder={t.contact_message_placeholder}
              className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none resize-none" />
          </div>
          <div>
            <input ref={fileRef} type="file" className="hidden" onChange={e => setAttachment(e.target.files?.[0] || null)} />
            <button type="button" onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors">
              <Paperclip className="size-4" />
              {attachment ? attachment.name : t.contact_attachment}
            </button>
          </div>
          {status === 'success' && <p className="text-sm text-sky-600 font-medium">{t.contact_success}</p>}
          {status === 'error' && <p className="text-sm text-red-400 font-medium">{t.contact_error}</p>}
          <button type="submit" disabled={status === 'sending'}
            className="w-full flex items-center justify-center gap-2 bg-sky-500 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-sky-500 transition-colors disabled:opacity-60">
            {status === 'sending' ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {status === 'sending' ? t.contact_sending : t.contact_send}
          </button>
        </form>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════
   LANDING PAGE, Liquid Stone & Glass (Dark)
   ════════════════════════════════════════════════ */
export function LandingPage() {
  const navigate = useNavigate();
  const pageRef = useRef<HTMLDivElement>(null);
  const [isExiting, setIsExiting] = useState(false);
  const [lang, setLangState] = useState<SalesLang>('fr');
  const [showContact, setShowContact] = useState(false);
  const t = salesTranslations[lang];

  const setLang = (newLang: SalesLang) => {
    setLangState(newLang);
    localStorage.setItem('closeos_lang', newLang);
  };

  useEffect(() => {
    const detected = detectSalesLang();
    setLangState(detected);
    localStorage.setItem('closeos_lang', detected);
  }, []);

  // Warm off-white page background (matches Business). Prevents the dark global
  // body bg (slate-950) from flashing through on fast scroll / overscroll bounce.
  useEffect(() => {
    const prevBody = document.body.style.backgroundColor;
    const prevHtml = document.documentElement.style.backgroundColor;
    document.body.style.backgroundColor = '#f4f2f1';
    document.documentElement.style.backgroundColor = '#f4f2f1';
    return () => {
      document.body.style.backgroundColor = prevBody;
      document.documentElement.style.backgroundColor = prevHtml;
    };
  }, []);

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'quarterly' | 'yearly'>('yearly');
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavigateToBusiness = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsExiting(true);
    setTimeout(() => navigate('/business'), 500);
  };

  const handleNavigateToSign = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsExiting(true);
    setTimeout(() => navigate('/sign'), 500);
  };

  const calculatePrice = (price: number) => {
    if (billingCycle === 'yearly') return +(price * 0.75).toFixed(2);
    if (billingCycle === 'quarterly') return +(price * (5 / 6)).toFixed(2);
    return price;
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref') || params.get('via');
    if (ref) {
      localStorage.setItem('referral_code', ref);
      localStorage.setItem('closeos_ref', ref);
      document.cookie = `closeos_ref=${encodeURIComponent(ref)};max-age=${30 * 24 * 60 * 60};path=/;SameSite=Lax`;
    }

    // Ambassador attribution (?amb=<slug>[&t=a|b]), server sets a 30d cookie
    const amb = params.get('amb');
    if (amb) {
      const tierRaw = (params.get('t') || params.get('tier') || 'a').toLowerCase();
      const tier = tierRaw === 'b' ? 'b' : 'a';
      localStorage.setItem('closeos_amb', amb);
      localStorage.setItem('closeos_amb_tier', tier);
      document.cookie = `closeos_amb_tier=${tier};max-age=${30 * 24 * 60 * 60};path=/;SameSite=Lax`;
      fetch('/api/amb-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: amb, tier }),
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    document.title = t.seo_title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', t.seo_description);
    // URL canonique de la landing Sales : /sales (cohérent avec /business et /sign).
    // /landing redirige en 301 vers /sales — voir vercel.json et scripts/seo-routes.mjs.
    document.getElementById('canonical')?.setAttribute('href', 'https://www.closeos.fr/sales');
    document.getElementById('og-url')?.setAttribute('content', 'https://www.closeos.fr/sales');
    document.getElementById('og-title')?.setAttribute('content', t.seo_title);
    document.getElementById('og-description')?.setAttribute('content', t.seo_description);
    document.getElementById('og-image')?.setAttribute('content', 'https://www.closeos.fr/og-sales.jpg');
    document.getElementById('tw-url')?.setAttribute('content', 'https://www.closeos.fr/sales');
    document.getElementById('tw-title')?.setAttribute('content', t.seo_title);
    document.getElementById('tw-description')?.setAttribute('content', t.seo_description);
    document.getElementById('tw-image')?.setAttribute('content', 'https://www.closeos.fr/og-sales.jpg');
    document.documentElement.lang = lang;

    // Pas d'alternate 'en' : ?lang=en sert le même HTML prérendu français, la balise mentirait.
    // À rétablir le jour où les pages anglaises auront leur propre chemin (/en/…).
    document.querySelectorAll('link[data-hreflang]').forEach(el => el.remove());
    [
      { lang: 'fr', href: 'https://www.closeos.fr/sales' },
      { lang: 'x-default', href: 'https://www.closeos.fr/sales' },
    ].forEach(({ lang: hl, href }) => {
      const link = document.createElement('link');
      link.rel = 'alternate'; link.hreflang = hl; link.href = href;
      link.setAttribute('data-hreflang', 'true');
      document.head.appendChild(link);
    });

    document.querySelector('script[data-closeos-sales-ld]')?.remove();
    document.querySelector('script[data-closeos-sales-faq-ld]')?.remove();
    document.querySelector('script[data-closeos-sales-breadcrumb-ld]')?.remove();

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-closeos-sales-ld', 'true');
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'WebApplication', name: 'CloseOS Sales',
      url: 'https://www.closeos.fr/sales', applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web', description: t.ld_description,
      offers: { '@type': 'AggregateOffer', lowPrice: '0', highPrice: '99', priceCurrency: 'EUR', availability: 'https://schema.org/InStock', offerCount: '3' },
      featureList: t.ld_features, inLanguage: lang,
    });
    document.head.appendChild(script);

    const faqScript = document.createElement('script');
    faqScript.type = 'application/ld+json';
    faqScript.setAttribute('data-closeos-sales-faq-ld', 'true');
    faqScript.textContent = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: t.ld_faq1_q, acceptedAnswer: { '@type': 'Answer', text: t.ld_faq1_a } },
        { '@type': 'Question', name: t.ld_faq2_q, acceptedAnswer: { '@type': 'Answer', text: t.ld_faq2_a } },
        { '@type': 'Question', name: t.ld_faq3_q, acceptedAnswer: { '@type': 'Answer', text: t.ld_faq3_a } },
        { '@type': 'Question', name: t.ld_faq4_q, acceptedAnswer: { '@type': 'Answer', text: t.ld_faq4_a } },
        { '@type': 'Question', name: t.ld_faq5_q, acceptedAnswer: { '@type': 'Answer', text: t.ld_faq5_a } },
        { '@type': 'Question', name: t.ld_faq6_q, acceptedAnswer: { '@type': 'Answer', text: t.ld_faq6_a } },
        { '@type': 'Question', name: t.ld_faq7_q, acceptedAnswer: { '@type': 'Answer', text: t.ld_faq7_a } },
      ],
    });
    document.head.appendChild(faqScript);

    const breadcrumbScript = document.createElement('script');
    breadcrumbScript.type = 'application/ld+json';
    breadcrumbScript.setAttribute('data-closeos-sales-breadcrumb-ld', 'true');
    breadcrumbScript.textContent = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'CloseOS', item: 'https://www.closeos.fr' },
        { '@type': 'ListItem', position: 2, name: 'CloseOS Sales', item: 'https://www.closeos.fr/sales' },
      ],
    });
    document.head.appendChild(breadcrumbScript);

    document.querySelector('script[data-closeos-sales-person-ld]')?.remove();
    const personScript = document.createElement('script');
    personScript.type = 'application/ld+json';
    personScript.setAttribute('data-closeos-sales-person-ld', 'true');
    personScript.textContent = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'Person', name: 'Thomas Shamoev', jobTitle: 'Fondateur',
      worksFor: { '@type': 'Organization', name: 'CloseOS' },
      image: 'https://qwjvdwpixewsctircibl.supabase.co/storage/v1/object/public/avatars/business-7d48e479-cede-480e-b405-39611a48d333-0.3286628360007747.jpg',
    });
    document.head.appendChild(personScript);

    return () => {
      document.querySelector('script[data-closeos-sales-ld]')?.remove();
      document.querySelector('script[data-closeos-sales-faq-ld]')?.remove();
      document.querySelector('script[data-closeos-sales-breadcrumb-ld]')?.remove();
      document.querySelector('script[data-closeos-sales-person-ld]')?.remove();
      document.querySelectorAll('link[data-hreflang]').forEach(el => el.remove());
    };
  }, [lang, t]);

  useEffect(() => {
    let s: HTMLScriptElement | null = null;
    const timer = setTimeout(() => {
      s = document.createElement('script');
      s.src = '/chatbot-widget.js';
      s.setAttribute('data-chatbot-id', 'acb35233-a6de-4738-9ba0-7e25c82c2a61');
      s.setAttribute('data-supabase-url', 'https://mkxcircbzcsjamslijde.supabase.co');
      s.setAttribute('data-supabase-key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1reGNpcmNiemNzamFtc2xpamRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MjM0MDAsImV4cCI6MjA4NzQ5OTQwMH0.9-abq1tEFsmjfRkLJjrkXlG3z-9o2HKYjyp5eBIl178');
      s.setAttribute('data-lang', lang);
      document.body.appendChild(s);
    }, 5000);
    return () => {
      clearTimeout(timer);
      if (s && document.body.contains(s)) document.body.removeChild(s);
      document.getElementById('chatbot-widget-container')?.remove();
    };
  }, [lang]);

  /* ─── RENDER ─── */
  return (
    <div ref={pageRef} className={`min-h-screen bg-[#f4f2f1] text-slate-800 selection:bg-sky-500/30 overflow-x-hidden transition-all duration-500 ${isExiting ? 'translate-y-full opacity-0' : 'animate-[pageEnterFromTop_0.5s_ease-out]'}`} style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ═══ NAVBAR, Floating pill (Business style) ═══ */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-7xl">
        <div className="bg-white/80 backdrop-blur-md border border-slate-200/60 rounded-2xl px-6 sm:px-8 py-3 flex items-center justify-between shadow-sm">
          <div className="relative group flex items-center gap-1.5 cursor-pointer">
            <img src="/logo-sales.png" alt="CloseOS Logo" className="h-9 w-auto" fetchPriority="high" width={120} height={48} />
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-800 transition-all duration-300 group-hover:rotate-180" strokeWidth={1.5} />
            <div className="absolute top-full left-0 right-0 mt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 translate-y-2 group-hover:translate-y-0">
              <a onClick={handleNavigateToBusiness} className="block rounded-xl border border-slate-200/60 bg-white p-4 shadow-lg hover:bg-slate-50 transition-colors cursor-pointer">
                <img src="/closeos-business-logo-ecrit.png" alt="CloseOS Business" className="w-full h-auto" loading="lazy" width={200} height={40} />
              </a>
              <a onClick={handleNavigateToSign} className="mt-2 block rounded-xl border border-slate-200/60 bg-[#191E1E] p-4 shadow-lg hover:bg-[#222828] transition-colors cursor-pointer">
                <img src="/CLOSEOS-SIGN-LOGO.png" alt="CloseOS Sign" className="w-full h-auto" loading="lazy" width={200} height={48} />
              </a>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-slate-900 transition-colors">{t.nav_features}</a>
            <a href="#roles" className="hover:text-slate-900 transition-colors">{t.nav_roles}</a>
            <a href="#comparison" className="hover:text-slate-900 transition-colors">{t.nav_comparison}</a>
            <a href="#pricing" className="text-sky-600 font-semibold">{t.nav_pricing}</a>
            <a href="#partners" className="hover:text-slate-900 transition-colors">{t.nav_partners}</a>
            <a href="#faq" className="hover:text-slate-900 transition-colors">{t.nav_faq}</a>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')} className="hidden md:flex items-center gap-1.5 p-2.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500" aria-label="Change language">
              <Globe className="size-4" strokeWidth={1.5} />
              <span className="text-xs font-bold uppercase">{lang === 'fr' ? 'EN' : 'FR'}</span>
            </button>
            <Link to="/login" className="hidden sm:flex items-center justify-center rounded-lg h-10 px-5 text-slate-700 text-sm font-semibold hover:text-slate-900 transition-all">
              {t.nav_login}
            </Link>
            <Link to="/register" className="hidden sm:flex group items-center gap-2 rounded-lg h-10 px-5 bg-sky-600 text-white text-sm font-semibold hover:bg-sky-500 transition-all">
              {t.nav_cta}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
            </Link>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-700" aria-label="Menu" aria-expanded={mobileMenuOpen}>
              {mobileMenuOpen ? <X className="h-5 w-5" strokeWidth={1.5} /> : <Menu className="h-5 w-5" strokeWidth={1.5} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-2 bg-white/90 backdrop-blur-md border border-slate-200/60 rounded-2xl px-6 py-4 shadow-lg flex flex-col gap-1 text-sm font-medium text-slate-600">
            {[
              { href: '#features', label: t.nav_features },
              { href: '#roles', label: t.nav_roles },
              { href: '#comparison', label: t.nav_comparison },
              { href: '#pricing', label: t.nav_pricing },
              { href: '#partners', label: t.nav_partners },
              { href: '#faq', label: t.nav_faq },
            ].map((item) => (
              <a key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)} className="py-2.5 px-3 rounded-lg hover:text-slate-900 hover:bg-slate-100 transition-colors">
                {item.label}
              </a>
            ))}
            <div className="mt-2 pt-3 border-t border-slate-200 space-y-2">
              <button onClick={() => { setLang(lang === 'fr' ? 'en' : 'fr'); setMobileMenuOpen(false) }} className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-slate-600 font-semibold hover:bg-slate-100 transition-colors">
                <Globe className="h-4 w-4" strokeWidth={1.5} />
                {lang === 'fr' ? 'English' : 'Français'}
              </button>
              <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-center w-full py-2.5 rounded-lg border border-slate-200 text-slate-700 font-semibold">
                {t.nav_login}
              </Link>
              <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-sky-600 text-white font-semibold">
                {t.nav_cta}
                <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* <main> : delimite le contenu principal pour les extracteurs (crawlers IA, lecteurs d'ecran). Sans lui, rien ne distingue le texte de navigation du contenu. */}
      <main>

      {/* ═══ HERO ═══ */}
      <section className="relative pt-28 pb-32 overflow-hidden">
        <div className="absolute top-0 right-[-10%] w-[600px] h-[600px] bg-sky-500/5 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-[-20%] left-[-8%] w-[500px] h-[500px] bg-sky-500/5 rounded-full blur-[120px] pointer-events-none" />

        {/* Doodles flottants (desktop) */}
        <div className="pointer-events-none select-none absolute inset-0 hidden md:block z-0" aria-hidden="true">
          <DoodleBubble className="absolute left-[6%] top-[40%] w-16 text-slate-800/80 -rotate-6" />
          <DoodleFace className="absolute right-[7%] top-[30%] w-14 text-slate-800/80 rotate-6" />
          <DoodlePlane className="absolute right-[9%] top-[56%] w-24 text-sky-500" />
          <DoodleSparkle className="absolute left-[11%] top-[24%] w-6 text-sky-400" />
          <DoodleSparkle className="absolute right-[16%] top-[18%] w-5 text-sky-400" />
          <DoodleCross className="absolute left-[17%] top-[62%] w-4 text-sky-400" />
          <DoodleCross className="absolute right-[22%] top-[68%] w-3.5 text-slate-300" />
          <DoodleDashes className="absolute left-[8%] top-[70%] w-12 text-slate-300 -rotate-6" />
        </div>

        <div className="relative mx-auto max-w-5xl px-6 z-10">
          {/* Badges */}
          <div className="flex justify-center mb-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="inline-flex items-center gap-2 rounded-full bg-sky-500/10 border border-sky-500/20 px-4 py-1.5 text-[0.72rem] font-semibold text-sky-600">
              {t.badge_env}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-1.5 text-[0.72rem] font-semibold text-slate-800">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
              </span>
              {t.badge_system}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-sky-500/10 border border-sky-500/20 px-4 py-1.5 text-[0.72rem] font-semibold text-sky-600">
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
              {t.badge_rgpd}
            </div>
          </div>

          {/* Title */}
          <h1 className="mx-auto max-w-[52rem] text-center text-[3.2rem] sm:text-[4.5rem] lg:text-[5.5rem] font-extrabold text-slate-900 leading-[0.95] mb-10 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.04em' }}>
            {t.hero_title_line1}<br />
            <span className="emerald-gradient-text">{t.hero_title_line2}</span>
            <br />
            <span className="relative inline-block">
              {t.hero_title_line3}
              <DoodleSquiggle className="absolute left-1/2 -translate-x-1/2 -bottom-3 w-48 sm:w-56 text-sky-500" />
            </span>
          </h1>

          <p className="mx-auto max-w-2xl text-center text-[1.05rem] text-slate-500 mb-12 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200 leading-[1.7]">
            {t.hero_subtitle}
          </p>

          <div className="flex items-center justify-center mb-10 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-250">
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 border border-slate-200 px-5 py-2 text-[0.82rem] font-medium text-slate-700">
              {t.hero_badge_focus}
            </span>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
            <Link to="/register" className="w-full sm:w-auto px-9 py-4 rounded-full bg-sky-600 text-white font-bold text-lg transition-all duration-300 hover:bg-sky-500 hover:text-white hover:shadow-[0_0_30px_rgba(2,132,199,0.25)] hover:-translate-y-1 flex items-center justify-center gap-2.5">
              <Zap className="h-5 w-5" strokeWidth={1.5} />
              {t.hero_cta}
            </Link>
            <Link to="/login" className="w-full sm:w-auto px-9 py-4 rounded-full glass-card text-slate-800 font-bold text-lg transition-all duration-300 hover:bg-slate-100 flex items-center justify-center gap-2">
              {t.hero_login}
            </Link>
          </div>

          <div className="mt-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
            <a href="https://www.whatsapp.com/channel/0029Vb7P4lqDDmFLVtD7Jn0s" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors group">
              <span className="text-sky-600">📲</span>
              <span className="underline underline-offset-4 decoration-slate-300 group-hover:decoration-sky-500 transition-all">{t.hero_whatsapp}</span>
            </a>
          </div>

          <p className="text-[0.72rem] text-slate-400 mt-3 text-center tracking-wide">{t.hero_no_card}</p>

          {/* Social proof */}
          <div className="mt-12 flex items-center justify-center gap-4 text-sm font-medium text-slate-500 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500">
            <div className="flex -space-x-3">
              {["/U1.jpg", "/U2.jpg", "/U3.jpg", "/U1.png"].map((src, i) => (
                <div key={i} className="h-10 w-10 rounded-full border-[3px] border-white relative z-0 hover:z-10 transition-all hover:scale-110">
                  <img src={src} alt="Closer" className="h-full w-full rounded-full object-cover" loading="lazy" width={40} height={40} />
                </div>
              ))}
            </div>
            <div className="flex flex-col text-left">
              <div className="flex text-sky-600 gap-0.5">
                {[...Array(5)].map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}
              </div>
              <span className="text-[0.82rem]">{t.hero_social_proof} <strong className="text-slate-900">{t.hero_social_proof_count}</strong></span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ INTEGRATIONS ═══ */}
      <motion.section id="integrations" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.8 }} className="py-16 border-t border-slate-200 relative overflow-hidden">
        <div className="pointer-events-none select-none absolute inset-0 hidden lg:block" aria-hidden="true">
          <DoodleBolt className="absolute left-[3%] top-[22%] w-4 text-sky-400" />
          <DoodleZigzag className="absolute left-[2%] top-[54%] w-12 text-slate-300" />
          <DoodleCross className="absolute left-[7%] top-[74%] w-3.5 text-slate-300" />
          <DoodleStar5 className="absolute right-[3%] top-[20%] w-6 text-sky-400" />
          <DoodleDashes className="absolute right-[2%] top-[54%] w-10 text-slate-300 -rotate-6" />
          <DoodleBurst className="absolute right-[7%] top-[70%] w-5 text-sky-400" />
        </div>
        <div className="mx-auto max-w-7xl px-6 text-center">
          <p className="text-[0.68rem] font-extrabold text-slate-400 mb-10 uppercase tracking-[0.25em]" style={{ fontFamily: "'Manrope', sans-serif" }}>
            {t.integrations_title}
          </p>
          <IntegrationsMarquee />
        </div>
      </motion.section>

      {/* ═══ FEATURES, Glass Grid ═══ */}
      <motion.section id="features" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.8 }} className="py-32 relative">
        <div className="absolute top-1/3 right-0 w-[400px] h-[400px] bg-sky-500/3 rounded-full blur-[120px] pointer-events-none" />
        <div className="pointer-events-none select-none absolute inset-0 hidden lg:block" aria-hidden="true">
          <DoodleChartUp className="absolute left-[2%] top-[8%] w-14 text-sky-500 -rotate-3" />
          <DoodleBolt className="absolute left-[7%] top-[26%] w-5 text-sky-400" />
          <DoodleTarget className="absolute left-[2%] top-[42%] w-12 text-slate-800/80" />
          <DoodleStar5 className="absolute left-[7%] top-[62%] w-5 text-sky-400" />
          <DoodleBubble className="absolute left-[2%] top-[80%] w-14 text-slate-800/80 -rotate-6" />
          <DoodleSparkle className="absolute right-[6%] top-[7%] w-6 text-sky-400" />
          <DoodlePlane className="absolute right-[2%] top-[24%] w-20 text-sky-500 rotate-12" />
          <DoodleBulb className="absolute right-[3%] top-[44%] w-11 text-slate-800/80" />
          <DoodleZigzag className="absolute right-[4%] top-[62%] w-12 text-slate-300" />
          <DoodleHeart className="absolute right-[7%] top-[82%] w-6 text-sky-400" />
        </div>
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-24 max-w-3xl">
            <h2 className="text-[2.8rem] sm:text-[3.8rem] font-extrabold text-slate-900 leading-[0.95] mb-7" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.04em' }}>
              {t.features_title.split('\n').map((line, i) => <span key={i}>{line}{i === 0 && <br />}</span>)}
            </h2>
            <p className="text-lg text-slate-500 leading-[1.7]">
              {t.features_subtitle}{' '}
              <span className="relative inline-block text-sky-600 font-semibold">
                {t.features_highlight}
                <DoodleCircle className="absolute -left-3 -right-3 -top-2 -bottom-2 w-[calc(100%+1.5rem)] h-[calc(100%+1rem)] text-sky-400" />
              </span>
            </p>
          </div>

          <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-5" variants={containerVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }}>

            {/* CARD 1, Cockpit */}
            <motion.div variants={itemVariants} className="md:col-span-2 glass-card rounded-2xl p-10 sm:p-12 hover:bg-slate-50 transition-all duration-500 group overflow-hidden relative">
              <div className="absolute -right-8 -top-8 w-40 h-40 bg-sky-500/5 rounded-full blur-[60px] group-hover:bg-sky-500/10 transition-all pointer-events-none" />
              <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-700">
                <LayoutDashboard className="w-72 h-72 text-sky-600" strokeWidth={0.8} />
              </div>
              <div className="relative z-10">
                <div className="p-3 rounded-xl bg-slate-100 text-sky-600 w-fit mb-8">
                  <BarChart3 className="h-7 w-7" strokeWidth={1.5} />
                </div>
                <h3 className="text-[1.6rem] font-extrabold text-slate-900 mb-4" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.03em' }}>{t.feat1_title}</h3>
                <p className="text-slate-500 mb-8 max-w-md leading-[1.7]">{t.feat1_desc}</p>
                <ul className="grid grid-cols-2 gap-3">
                  {[t.feat1_item1, t.feat1_item2, t.feat1_item3, t.feat1_item4].map((item, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm text-slate-700"><CheckCircle2 className="h-4 w-4 text-sky-600 shrink-0" strokeWidth={1.5} /> {item}</li>
                  ))}
                </ul>
              </div>
            </motion.div>

            {/* CARD 2, Calls & WhatsApp */}
            <motion.div variants={itemVariants} className="glass-card rounded-2xl p-10 hover:bg-slate-50 transition-all duration-500 group relative overflow-hidden">
              <div className="absolute -right-6 -bottom-6 opacity-[0.04] group-hover:opacity-[0.1] transition-opacity duration-700">
                <MessageSquare className="w-36 h-36 text-[#0ea5e9]" strokeWidth={0.8} />
              </div>
              <div className="p-3 rounded-xl bg-slate-100 text-[#0ea5e9] w-fit mb-8">
                <Phone className="h-7 w-7" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 mb-4" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.03em' }}>{t.feat2_title}</h3>
              <p className="text-slate-500 text-sm leading-[1.7] mb-5">{t.feat2_desc}</p>
              <span className="text-sky-600 text-[0.68rem] font-extrabold uppercase tracking-[0.18em]">{t.feat2_badge}</span>
            </motion.div>

            {/* Mini-quote 1 */}
            <motion.div variants={itemVariants} className="md:col-span-3 py-4 relative">
              <DoodleStar5 className="pointer-events-none select-none absolute left-[16%] top-1/2 -translate-y-1/2 w-5 text-sky-400 hidden lg:block" aria-hidden="true" />
              <DoodleArrowDown className="pointer-events-none select-none absolute right-[16%] top-1/2 -translate-y-1/2 w-8 text-slate-300 hidden lg:block" aria-hidden="true" />
              <p className="text-slate-500 text-sm italic text-center">
                "{lang === 'fr' ? 'Mon pipeline est passé de chaotique à limpide en une semaine.' : 'My pipeline went from chaotic to crystal clear in one week.'}"
                <span className="text-slate-400 not-italic ml-2">Léonie M., {lang === 'fr' ? 'closer indépendante' : 'independent closer'}</span>
              </p>
            </motion.div>

            {/* CARD 3, Pipeline */}
            <motion.div variants={itemVariants} className="glass-card rounded-2xl p-10 hover:bg-slate-50 transition-all duration-500 group">
              <div className="p-3 rounded-xl bg-slate-100 text-sky-600 w-fit mb-8">
                <TrendingUp className="h-7 w-7" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 mb-4" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.03em' }}>{t.feat3_title}</h3>
              <p className="text-slate-500 text-sm leading-[1.7]">{t.feat3_desc}</p>
            </motion.div>

            {/* CARD 4, Profil Closer */}
            <motion.div variants={itemVariants} className="md:col-span-2 glass-card rounded-2xl p-10 sm:p-12 hover:bg-slate-50 transition-all duration-500 group overflow-hidden relative">
              <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-700">
                <Users className="w-72 h-72 text-sky-600" strokeWidth={0.8} />
              </div>
              <div className="relative z-10">
                <div className="p-3 rounded-xl bg-slate-100 text-sky-600 w-fit mb-8">
                  <ArrowRight className="h-7 w-7" strokeWidth={1.5} />
                </div>
                <h3 className="text-[1.6rem] font-extrabold text-slate-900 mb-4" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.03em' }}>{t.feat4_title}</h3>
                <p className="text-slate-500 mb-8 max-w-lg leading-[1.7]">{t.feat4_desc}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { title: t.feat4_bio, desc: t.feat4_bio_desc },
                    { title: t.feat4_instant, desc: t.feat4_instant_desc },
                    { title: t.feat4_tracking, desc: t.feat4_tracking_desc },
                  ].map((sub, idx) => (
                    <div key={idx} className="rounded-xl bg-slate-50 border border-slate-200 p-5">
                      <p className="text-[0.65rem] font-extrabold text-sky-600 uppercase tracking-[0.18em] mb-3" style={{ fontFamily: "'Manrope', sans-serif" }}>{sub.title}</p>
                      <p className="text-[0.85rem] text-slate-500 leading-[1.65]">{sub.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Mini-quote 2 */}
            <motion.div variants={itemVariants} className="md:col-span-3 py-4 relative">
              <DoodleHeart className="pointer-events-none select-none absolute left-[15%] top-1/2 -translate-y-1/2 w-5 text-sky-400 hidden lg:block" aria-hidden="true" />
              <DoodleBurst className="pointer-events-none select-none absolute right-[15%] top-1/2 -translate-y-1/2 w-5 text-sky-400 hidden lg:block" aria-hidden="true" />
              <p className="text-slate-500 text-sm italic text-center">
                "{lang === 'fr' ? 'Plus aucun RDV oublié. Mes no-show ont chuté de 40%.' : 'No more forgotten appointments. My no-shows dropped by 40%.'}"
                <span className="text-slate-400 not-italic ml-2">Samir K., {lang === 'fr' ? 'closer en agence' : 'agency closer'}</span>
              </p>
            </motion.div>

            {/* CARD 5, Agenda */}
            <motion.div variants={itemVariants} className="glass-card rounded-2xl p-10 hover:bg-slate-50 transition-all duration-500 group overflow-hidden relative">
              <div className="absolute -right-6 -bottom-6 opacity-[0.04] group-hover:opacity-[0.1] transition-opacity duration-700">
                <CalendarCheck className="w-36 h-36 text-sky-600" strokeWidth={0.8} />
              </div>
              <div className="relative z-10">
                <div className="p-3 rounded-xl bg-slate-100 text-sky-600 w-fit mb-8">
                  <CalendarCheck className="h-7 w-7" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 mb-4" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.03em' }}>{t.feat5_title}</h3>
                <p className="text-slate-500 text-sm leading-[1.7] mb-5">{t.feat5_desc}</p>
                <div className="flex flex-wrap gap-2">
                  {[t.feat5_tag1, t.feat5_tag2, t.feat5_tag3].map((tag, idx) => (
                    <span key={idx} className="px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-[0.68rem] font-semibold text-sky-600">{tag}</span>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* CARD 6, Facturation */}
            <motion.div variants={itemVariants} className="glass-card rounded-2xl p-10 hover:bg-slate-50 transition-all duration-500 group">
              <div className="p-3 rounded-xl bg-slate-100 text-sky-600 w-fit mb-8">
                <FileText className="h-7 w-7" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 mb-4" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.03em' }}>{t.feat6_title}</h3>
              <p className="text-slate-500 text-sm leading-[1.7]">{t.feat6_desc}</p>
            </motion.div>

            {/* CARD 7, Sync CRM */}
            <motion.div variants={itemVariants} className="glass-card rounded-2xl p-10 hover:bg-slate-50 transition-all duration-500 group overflow-hidden relative">
              <div className="absolute -right-6 -bottom-6 opacity-[0.04] group-hover:opacity-[0.1] transition-opacity duration-700">
                <Zap className="w-36 h-36 text-sky-600" strokeWidth={0.8} />
              </div>
              <div className="relative z-10">
                <div className="p-3 rounded-xl bg-slate-100 text-sky-600 w-fit mb-8">
                  <Zap className="h-7 w-7" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 mb-4" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.03em' }}>{t.feat7_title}</h3>
                <p className="text-slate-500 text-sm leading-[1.7]">{t.feat7_desc}</p>
              </div>
            </motion.div>

            {/* CARD 8, Call Room */}
            <motion.div variants={itemVariants} className="md:col-span-2 glass-card rounded-2xl p-10 sm:p-12 hover:bg-slate-50 transition-all duration-500 group overflow-hidden relative">
              <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-700">
                <Phone className="w-72 h-72 text-sky-600" strokeWidth={0.8} />
              </div>
              <div className="relative z-10">
                <div className="p-3 rounded-xl bg-slate-100 text-sky-600 w-fit mb-8">
                  <Phone className="h-7 w-7" strokeWidth={1.5} />
                </div>
                <h3 className="text-[1.6rem] font-extrabold text-slate-900 mb-4" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.03em' }}>{t.feat8_title}</h3>
                <p className="text-slate-500 mb-8 max-w-lg leading-[1.7]">{t.feat8_desc}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { title: t.feat8_a_title, desc: t.feat8_a_desc },
                    { title: t.feat8_b_title, desc: t.feat8_b_desc },
                    { title: t.feat8_c_title, desc: t.feat8_c_desc },
                  ].map((sub, idx) => (
                    <div key={idx} className="rounded-xl bg-slate-50 border border-slate-200 p-5">
                      <p className="text-[0.65rem] font-extrabold text-sky-600 uppercase tracking-[0.18em] mb-3" style={{ fontFamily: "'Manrope', sans-serif" }}>{sub.title}</p>
                      <p className="text-[0.85rem] text-slate-500 leading-[1.65]">{sub.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* CARD 9, Relances automatiques */}
            <motion.div variants={itemVariants} className="glass-card rounded-2xl p-10 hover:bg-slate-50 transition-all duration-500 group overflow-hidden relative">
              <div className="absolute -right-6 -bottom-6 opacity-[0.04] group-hover:opacity-[0.1] transition-opacity duration-700">
                <Clock className="w-36 h-36 text-sky-600" strokeWidth={0.8} />
              </div>
              <div className="relative z-10">
                <div className="p-3 rounded-xl bg-slate-100 text-sky-600 w-fit mb-8">
                  <Clock className="h-7 w-7" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 mb-4" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.03em' }}>{t.feat9_title}</h3>
                <p className="text-slate-500 text-sm leading-[1.7]">{t.feat9_desc}</p>
              </div>
            </motion.div>

            {/* CARD 10, Rapport de perf hebdo */}
            <motion.div variants={itemVariants} className="glass-card rounded-2xl p-10 hover:bg-slate-50 transition-all duration-500 group">
              <div className="p-3 rounded-xl bg-slate-100 text-sky-600 w-fit mb-8">
                <BarChart3 className="h-7 w-7" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 mb-4" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.03em' }}>{t.feat10_title}</h3>
              <p className="text-slate-500 text-sm leading-[1.7]">{t.feat10_desc}</p>
            </motion.div>

            {/* CARD 11, Détection de doublons */}
            <motion.div variants={itemVariants} className="glass-card rounded-2xl p-10 hover:bg-slate-50 transition-all duration-500 group overflow-hidden relative">
              <div className="absolute -right-6 -bottom-6 opacity-[0.04] group-hover:opacity-[0.1] transition-opacity duration-700">
                <Layers className="w-36 h-36 text-sky-600" strokeWidth={0.8} />
              </div>
              <div className="relative z-10">
                <div className="p-3 rounded-xl bg-slate-100 text-sky-600 w-fit mb-8">
                  <Layers className="h-7 w-7" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 mb-4" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.03em' }}>{t.feat11_title}</h3>
                <p className="text-slate-500 text-sm leading-[1.7]">{t.feat11_desc}</p>
              </div>
            </motion.div>

            {/* CARD 12, Tâches par prospect */}
            <motion.div variants={itemVariants} className="glass-card rounded-2xl p-10 hover:bg-slate-50 transition-all duration-500 group">
              <div className="p-3 rounded-xl bg-slate-100 text-sky-600 w-fit mb-8">
                <CheckCircle className="h-7 w-7" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 mb-4" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.03em' }}>{t.feat12_title}</h3>
              <p className="text-slate-500 text-sm leading-[1.7]">{t.feat12_desc}</p>
            </motion.div>

            {/* CARD 13, Suivi de discussion & taux de réponse */}
            <motion.div variants={itemVariants} className="md:col-span-2 glass-card rounded-2xl p-10 sm:p-12 hover:bg-slate-50 transition-all duration-500 group overflow-hidden relative">
              <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-700">
                <MessageSquare className="w-72 h-72 text-sky-600" strokeWidth={0.8} />
              </div>
              <div className="relative z-10">
                <div className="p-3 rounded-xl bg-slate-100 text-sky-600 w-fit mb-8">
                  <MessageSquare className="h-7 w-7" strokeWidth={1.5} />
                </div>
                <h3 className="text-[1.6rem] font-extrabold text-slate-900 mb-4" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.03em' }}>{t.feat13_title}</h3>
                <p className="text-slate-500 mb-8 max-w-lg leading-[1.7]">{t.feat13_desc}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { title: t.feat13_a_title, desc: t.feat13_a_desc },
                    { title: t.feat13_b_title, desc: t.feat13_b_desc },
                    { title: t.feat13_c_title, desc: t.feat13_c_desc },
                  ].map((sub, idx) => (
                    <div key={idx} className="rounded-xl bg-slate-50 border border-slate-200 p-5">
                      <p className="text-[0.65rem] font-extrabold text-sky-600 uppercase tracking-[0.18em] mb-3" style={{ fontFamily: "'Manrope', sans-serif" }}>{sub.title}</p>
                      <p className="text-[0.85rem] text-slate-500 leading-[1.65]">{sub.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* COLONNE : Digest (14) + Rappels (15) empilés, à droite de la carte 13 */}
            <motion.div variants={itemVariants} className="flex flex-col gap-5">
              {/* Digest "Toujours en discussion ?" 17h */}
              <div className="glass-card rounded-2xl p-8 hover:bg-slate-50 transition-all duration-500 group overflow-hidden relative flex-1 flex flex-col">
                <div className="absolute -right-6 -bottom-6 opacity-[0.04] group-hover:opacity-[0.1] transition-opacity duration-700">
                  <Send className="w-32 h-32 text-sky-600" strokeWidth={0.8} />
                </div>
                <div className="relative z-10">
                  <div className="p-3 rounded-xl bg-slate-100 text-sky-600 w-fit mb-6">
                    <Send className="h-6 w-6" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900 mb-3" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.03em' }}>{t.feat14_title}</h3>
                  <p className="text-slate-500 text-sm leading-[1.65]">{t.feat14_desc}</p>
                </div>
              </div>
              {/* Rappels à heure précise */}
              <div className="glass-card rounded-2xl p-8 hover:bg-slate-50 transition-all duration-500 group overflow-hidden relative flex-1 flex flex-col">
                <div className="absolute -right-6 -bottom-6 opacity-[0.04] group-hover:opacity-[0.1] transition-opacity duration-700">
                  <AlarmClock className="w-32 h-32 text-sky-600" strokeWidth={0.8} />
                </div>
                <div className="relative z-10">
                  <div className="p-3 rounded-xl bg-slate-100 text-sky-600 w-fit mb-6">
                    <AlarmClock className="h-6 w-6" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900 mb-3" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.03em' }}>{t.feat15_title}</h3>
                  <p className="text-slate-500 text-sm leading-[1.65]">{t.feat15_desc}</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </motion.section>

      {/* ═══ TESTIMONIALS ═══ */}
      <motion.section initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.8 }} className="py-32 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sky-500/[0.05] blur-[180px] rounded-full pointer-events-none" />
        <div className="pointer-events-none select-none absolute inset-0 hidden lg:block" aria-hidden="true">
          <DoodleHeart className="absolute left-[4%] top-[12%] w-8 text-sky-400 -rotate-6" />
          <DoodleStar5 className="absolute left-[9%] top-[34%] w-5 text-sky-400" />
          <DoodleFace className="absolute left-[3%] top-[56%] w-12 text-slate-800/80 -rotate-3" />
          <DoodleBurst className="absolute left-[7%] top-[80%] w-5 text-sky-400" />
          <DoodleStar5 className="absolute right-[7%] top-[10%] w-6 text-sky-400" />
          <DoodleBubble className="absolute right-[3%] top-[32%] w-14 text-slate-800/80 rotate-6" />
          <DoodleHeart className="absolute right-[6%] top-[60%] w-6 text-sky-400 rotate-6" />
          <DoodleCross className="absolute right-[10%] top-[82%] w-3.5 text-slate-300" />
        </div>
        <div className="mx-auto max-w-6xl px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-[2.5rem] sm:text-[3.5rem] font-extrabold text-slate-900 leading-[0.95] inline-block relative" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.04em' }}>
              {t.testimonials_title}
              <DoodleSquiggle className="absolute left-1/2 -translate-x-1/2 -bottom-3 w-48 text-sky-500" />
            </h2>
            <p className="text-slate-500 mt-5 text-lg">{t.testimonials_subtitle}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: lang === 'fr'
                  ? "J'ai remplacé 4 outils par CloseOS. Mon pipeline est enfin lisible, mes relances sont automatiques. J'ai gagné 6h par semaine, facilement."
                  : "I replaced 4 tools with CloseOS. My pipeline is finally readable, my follow-ups are automatic. I easily save 6 hours a week.",
                name: 'Margaux D.',
                role: lang === 'fr' ? 'Closer indépendante' : 'Independent closer',
                initials: 'MD',
                color: 'emerald',
              },
              {
                quote: lang === 'fr'
                  ? "Avant je perdais des prospects parce que j'oubliais de relancer. Depuis CloseOS, mon taux de closing est passé de 18% à 31%. Les chiffres parlent."
                  : "I used to lose prospects because I forgot to follow up. Since CloseOS, my closing rate went from 18% to 31%. The numbers speak.",
                name: 'Naël B.',
                role: lang === 'fr' ? 'Closer pour agence média' : 'Closer for media agency',
                initials: 'NB',
                color: 'purple',
              },
              {
                quote: lang === 'fr'
                  ? "L'interface est ultra propre. On sent que c'est pensé par quelqu'un qui a déjà closé. Pas un outil générique de plus."
                  : "The interface is super clean. You can tell it was built by someone who actually closes. Not just another generic tool.",
                name: 'Tiago F.',
                role: lang === 'fr' ? 'Infopreneur & closer' : 'Infopreneur & closer',
                initials: 'TF',
                color: 'amber',
              },
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.15 }}
                className="glass-card rounded-2xl p-8 flex flex-col relative group hover:bg-slate-50 transition-colors duration-500"
              >
                <Quote className="w-8 h-8 text-slate-100 mb-4" strokeWidth={1.5} />
                <p className="text-slate-700 text-[0.95rem] leading-[1.7] flex-1 italic">"{item.quote}"</p>
                <div className="flex items-center gap-3 mt-8 pt-6 border-t border-slate-200">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    item.color === 'emerald' ? 'bg-sky-500/15 text-sky-600' :
                    item.color === 'purple' ? 'bg-sky-500/15 text-sky-600' :
                    'bg-sky-500/15 text-sky-600'
                  }`}>
                    {item.initials}
                  </div>
                  <div>
                    <p className="text-slate-900 font-bold text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>{item.name}</p>
                    <p className="text-slate-500 text-xs">{item.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ═══ ROLES ═══ */}
      <motion.section id="roles" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.8 }} className="py-32 border-t border-slate-200 relative overflow-hidden">
        <div className="absolute top-1/2 left-[-5%] -translate-y-1/2 w-[500px] h-[500px] bg-sky-500/5 blur-[150px] rounded-full pointer-events-none" />
        <div className="absolute top-1/2 right-[-5%] -translate-y-1/2 w-[500px] h-[500px] bg-sky-500/5 blur-[150px] rounded-full pointer-events-none" />
        <div className="pointer-events-none select-none absolute inset-0 hidden lg:block" aria-hidden="true">
          <DoodleTarget className="absolute left-[3%] top-[16%] w-12 text-slate-800/80" />
          <DoodleBolt className="absolute left-[8%] top-[42%] w-5 text-sky-400" />
          <DoodleStar5 className="absolute left-[5%] top-[66%] w-5 text-sky-400" />
          <DoodleBubble className="absolute left-[3%] top-[82%] w-14 text-slate-800/80 -rotate-6" />
          <DoodleBurst className="absolute right-[6%] top-[14%] w-6 text-sky-400" />
          <DoodleTrophy className="absolute right-[3%] top-[38%] w-11 text-slate-800/80 rotate-6" />
          <DoodleDashes className="absolute right-[4%] top-[64%] w-12 text-slate-300 rotate-6" />
          <DoodleCross className="absolute right-[8%] top-[84%] w-3.5 text-slate-300" />
        </div>

        <div className="mx-auto max-w-7xl px-6 relative z-10">
          <div className="text-center mb-16">
            <p className="text-sky-600 text-[0.7rem] font-extrabold uppercase tracking-[0.2em] mb-4" style={{ fontFamily: "'Manrope', sans-serif" }}>{t.roles_eyebrow}</p>
            <h2 className="text-[2.5rem] sm:text-[3.5rem] font-extrabold text-slate-900 leading-[0.95]" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.04em' }}>{t.roles_title}</h2>
            <p className="text-slate-500 mt-5 text-lg max-w-3xl mx-auto">{t.roles_subtitle}</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
            {[
              {
                name: t.role_closer_name,
                tag: t.role_closer_tag,
                desc: t.role_closer_desc,
                icon: <Phone className="w-6 h-6" strokeWidth={1.5} />,
                accent: 'emerald',
                bullets: [t.role_closer_b1, t.role_closer_b2, t.role_closer_b3],
              },
              {
                name: t.role_setter_name,
                tag: t.role_setter_tag,
                desc: t.role_setter_desc,
                icon: <CalendarCheck className="w-6 h-6" strokeWidth={1.5} />,
                accent: 'cyan',
                bullets: [t.role_setter_b1, t.role_setter_b2, t.role_setter_b3],
              },
              {
                name: t.role_sc_name,
                tag: t.role_sc_tag,
                desc: t.role_sc_desc,
                icon: <Layers className="w-6 h-6" strokeWidth={1.5} />,
                accent: 'amber',
                featured: true,
                bullets: [t.role_sc_b1, t.role_sc_b2, t.role_sc_b3, t.role_sc_b4],
              },
            ].map((role, idx) => {
              const accentMap: Record<string, { bg: string; text: string; border: string; glow: string; tag: string }> = {
                emerald: { bg: 'bg-sky-500/10', text: 'text-sky-600', border: 'border-sky-500/20', glow: 'bg-sky-500/10', tag: 'text-sky-600' },
                cyan: { bg: 'bg-sky-500/10', text: 'text-sky-600', border: 'border-sky-500/20', glow: 'bg-sky-500/10', tag: 'text-sky-600' },
                amber: { bg: 'bg-sky-500/10', text: 'text-sky-600', border: 'border-sky-500/30', glow: 'bg-sky-500/10', tag: 'text-sky-600' },
              }
              const a = accentMap[role.accent]
              return (
                <div key={idx} className={`relative rounded-2xl p-8 bg-white border ${role.featured ? a.border : 'border-slate-200/70'} flex flex-col overflow-hidden transition-all shadow-[0_1px_2px_rgba(15,23,42,0.04),0_14px_34px_-16px_rgba(15,23,42,0.10)] hover:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_40px_-14px_rgba(2,132,199,0.16)] ${role.featured ? 'shadow-[0_0_40px_rgba(2,132,199,0.12)]' : ''}`}>
                  <div className={`absolute -right-8 -top-8 w-32 h-32 ${a.glow} rounded-full blur-[60px] pointer-events-none`} />

                  <div className="flex items-center gap-4 mb-5 relative z-10">
                    <div className={`p-3 rounded-xl ${a.bg} ${a.text}`}>{role.icon}</div>
                    <div>
                      <h3 className="text-[1.5rem] font-extrabold text-slate-900 leading-tight" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.03em' }}>{role.name}</h3>
                      <p className={`text-[0.75rem] font-bold uppercase tracking-[0.12em] mt-0.5 ${a.tag}`} style={{ fontFamily: "'Manrope', sans-serif" }}>{role.tag}</p>
                    </div>
                  </div>

                  <p className="text-sm text-slate-500 leading-[1.65] mb-7 relative z-10">{role.desc}</p>

                  <ul className="space-y-3 flex-1 relative z-10">
                    {role.bullets.map((b, bIdx) => (
                      <li key={bIdx} className="flex items-start gap-3 text-[0.875rem] text-slate-700">
                        <CheckCircle2 className={`w-4 h-4 ${a.text} shrink-0 mt-[3px]`} strokeWidth={2} />
                        <span className="leading-snug">{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>

          <p className="text-center text-slate-500 mt-12 text-sm">{t.roles_footer}</p>
        </div>
      </motion.section>

      {/* ═══ COMPARISON ═══ */}
      <motion.section id="comparison" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.8 }} className="py-32 border-t border-slate-200 relative overflow-hidden">
        <div className="absolute top-1/2 left-[-5%] -translate-y-1/2 w-[500px] h-[500px] bg-red-500/3 blur-[150px] rounded-full pointer-events-none" />
        <div className="absolute top-1/2 right-[-5%] -translate-y-1/2 w-[500px] h-[500px] bg-sky-500/5 blur-[150px] rounded-full pointer-events-none" />
        <div className="pointer-events-none select-none absolute inset-0 hidden lg:block" aria-hidden="true">
          <DoodleClock className="absolute left-[3%] top-[14%] w-12 text-slate-800/80" />
          <DoodleDashes className="absolute left-[7%] top-[40%] w-11 text-slate-300 -rotate-6" />
          <DoodleFace className="absolute left-[3%] top-[62%] w-12 text-slate-800/80 -rotate-3" />
          <DoodleCross className="absolute left-[8%] top-[84%] w-4 text-slate-300" />
          <DoodleCheck className="absolute right-[5%] top-[12%] w-8 text-sky-500" />
          <DoodleChartUp className="absolute right-[3%] top-[36%] w-12 text-sky-500 rotate-3" />
          <DoodleStar5 className="absolute right-[8%] top-[64%] w-5 text-sky-400" />
          <DoodleZigzag className="absolute right-[4%] top-[86%] w-12 text-slate-300" />
        </div>

        <div className="mx-auto max-w-7xl px-6 relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-[2.5rem] sm:text-[3.5rem] font-extrabold text-slate-900 leading-[0.95]" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.04em' }}>{t.comp_title}</h2>
            <p className="text-slate-500 mt-5 text-lg">{t.comp_subtitle}</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 lg:gap-10 items-stretch">
            {/* Old method */}
            <div className="glass-card rounded-2xl p-10 flex flex-col relative overflow-hidden">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-red-500/5 rounded-full blur-[60px] pointer-events-none" />
              <div className="flex items-center gap-4 mb-10">
                <div className="p-3 rounded-xl bg-red-500/10 text-red-500"><XCircle className="w-6 h-6" strokeWidth={1.5} /></div>
                <h3 className="text-[1.5rem] font-extrabold text-slate-900" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.03em' }}>{t.comp_old_title}</h3>
              </div>
              <div className="space-y-3 flex-1">
                {[
                  { icon: <Database className="w-4 h-4" strokeWidth={1.5} />, text: t.comp_old1, badge: t.comp_old1_badge },
                  { icon: <Sheet className="w-4 h-4" strokeWidth={1.5} />, text: t.comp_old2, badge: t.comp_old2_badge },
                  { icon: <Phone className="w-4 h-4" strokeWidth={1.5} />, text: t.comp_old3, badge: t.comp_old3_badge },
                  { icon: <FileText className="w-4 h-4" strokeWidth={1.5} />, text: t.comp_old4, badge: t.comp_old4_badge },
                  { icon: <Clock className="w-4 h-4" strokeWidth={1.5} />, text: t.comp_old5, badge: t.comp_old5_badge },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-red-500/[0.04] border border-red-500/10 text-sm">
                    <div className="flex items-center gap-3 text-slate-500">{item.icon} {item.text}</div>
                    <span className="font-bold text-red-400 text-[0.75rem] shrink-0 ml-2">{item.badge}</span>
                  </div>
                ))}
              </div>
              <div className="mt-10 pt-8 border-t border-slate-200 text-center">
                <div className="mb-6">
                  <div className="text-lg font-bold text-slate-800">{t.comp_co2_old} <span className="text-sm font-normal text-slate-500">{t.comp_co2_old_unit}</span></div>
                  <p className="text-[0.65rem] text-red-400/60 mt-1 leading-tight">{t.comp_co2_old_note}</p>
                </div>
                <div className="pt-6 border-t border-slate-200">
                  <p className="text-red-400 text-[0.65rem] font-extrabold uppercase tracking-[0.2em] mb-1" style={{ fontFamily: "'Manrope', sans-serif" }}>{t.comp_loss_label}</p>
                  <div className="text-[3rem] font-black text-slate-900" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.04em' }}>
                    10h<span className="text-lg text-slate-400 font-medium">/semaine</span>
                  </div>
                </div>
              </div>
            </div>

            {/* CloseOS, Gradient border */}
            <div className="relative pt-4">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 premium-gradient text-white text-[0.68rem] font-extrabold px-5 py-2 rounded-full shadow-[0_0_20px_rgba(2,132,199,0.25)]" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '0.08em' }}>
                {t.comp_new_badge}
              </div>
              <div className="relative rounded-2xl overflow-hidden p-[1px] bg-gradient-to-br from-sky-500/40 via-[#c4c7c7]/10 to-sky-500/20">
              <div className="bg-white rounded-[calc(1rem-1px)] p-10 h-full flex flex-col relative overflow-hidden">
                <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-sky-500/10 blur-[60px] pointer-events-none" />
                <div className="flex items-center gap-4 mb-10 mt-4">
                  <div className="p-3 rounded-xl bg-sky-500/10 text-sky-600"><CheckCircle2 className="w-6 h-6" strokeWidth={1.5} /></div>
                  <h3 className="text-[1.5rem] font-extrabold text-slate-900" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.03em' }}>{t.comp_new_title}</h3>
                </div>

                <div className="flex-1 bg-slate-50 rounded-xl p-7 border border-slate-200 space-y-7 flex flex-col justify-center">
                  {[
                    { icon: <TrendingUp className="w-5 h-5" strokeWidth={1.5} />, color: 'text-sky-600', bg: 'bg-sky-500/10', title: t.comp_roi_title, desc: t.comp_roi_desc },
                    { icon: <BrainCircuit className="w-5 h-5" strokeWidth={1.5} />, color: 'text-sky-600', bg: 'bg-sky-500/10', title: t.comp_brain_title, desc: t.comp_brain_desc },
                    { icon: <Star className="w-5 h-5" strokeWidth={1.5} />, color: 'text-sky-600', bg: 'bg-sky-500/10', title: t.comp_pro_title, desc: t.comp_pro_desc },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-4">
                      <div className={`p-2.5 rounded-xl ${item.bg} ${item.color} shrink-0`}>{item.icon}</div>
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-[0.95rem]" style={{ fontFamily: "'Manrope', sans-serif" }}>{item.title}</h4>
                        <p className="text-sm text-slate-500 leading-[1.6] mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-10 pt-8 border-t border-slate-200 text-center relative">
                  <div className="mb-6 group relative cursor-help">
                    <div className="text-lg font-bold text-slate-800">{t.comp_co2_new} <span className="text-sm font-normal text-slate-500">{t.comp_co2_new_unit}</span></div>
                    <p className="text-[0.75rem] text-sky-600/80 mt-1 leading-snug">{t.comp_co2_new_note}</p>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-4 glass-card rounded-2xl text-[0.75rem] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      {t.comp_co2_tooltip}
                      <div className="absolute bottom-[-5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white rotate-45 border-b border-r border-slate-200"></div>
                    </div>
                  </div>
                  <div className="pt-6 border-t border-slate-200">
                    <p className="emerald-gradient-text text-sm font-bold uppercase tracking-[0.15em]" style={{ fontFamily: "'Manrope', sans-serif" }}>Pack Pro</p>
                    <div className="text-[3.2rem] font-black text-slate-900" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.04em' }}>
                      24€<span className="text-lg text-slate-400 font-medium">/mois</span>
                    </div>
                    <p className="text-sky-600 text-[0.75rem] font-bold mt-2 flex items-center justify-center gap-1.5">
                      <Zap className="w-3.5 h-3.5" strokeWidth={1.5} />{t.comp_pack_tagline}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ═══ PRICING ═══ */}
      <motion.section id="pricing" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.8 }} className="py-32 relative border-t border-slate-200">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-sky-500/5 rounded-full blur-[140px] pointer-events-none" />
        <div className="pointer-events-none select-none absolute inset-0 hidden lg:block" aria-hidden="true">
          <DoodleCoin className="absolute left-[6%] top-[10%] w-11 text-sky-500 -rotate-6" />
          <DoodleStar5 className="absolute left-[10%] top-[34%] w-5 text-sky-400" />
          <DoodleTrophy className="absolute left-[3%] top-[56%] w-11 text-slate-800/80" />
          <DoodleDashes className="absolute left-[6%] top-[80%] w-11 text-slate-300 rotate-6" />
          <DoodleBurst className="absolute right-[8%] top-[16%] w-6 text-sky-400" />
          <DoodleFace className="absolute right-[5%] top-[38%] w-12 text-slate-800/80 rotate-6" />
          <DoodleBolt className="absolute right-[10%] top-[62%] w-5 text-sky-400" />
          <DoodleStar5 className="absolute right-[6%] top-[84%] w-5 text-sky-400" />
        </div>
        <div className="mx-auto max-w-7xl px-6 relative z-10">
          <div className="text-center mb-14">
            <h2 className="text-[2.5rem] sm:text-[3.5rem] font-extrabold text-slate-900 leading-[0.95]" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.04em' }}>{t.pricing_title}</h2>
            <p className="text-slate-500 mt-5 text-lg">{t.pricing_subtitle}</p>
            <p className="text-slate-900 mt-5 text-2xl font-extrabold inline-block relative" style={{ fontFamily: "'Manrope', sans-serif" }}>
              {t.pricing_trial}
              <DoodleSquiggle className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-52 text-sky-500" />
            </p>
          </div>

          <div className="flex flex-col items-center mb-14">
            <div className="inline-flex items-center gap-1 p-1 rounded-full bg-slate-100 border border-slate-200">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${billingCycle === 'monthly' ? 'bg-sky-600 text-white' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {t.pricing_monthly}
              </button>
              <button
                onClick={() => setBillingCycle('quarterly')}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${billingCycle === 'quarterly' ? 'bg-sky-600 text-white' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {t.pricing_quarterly}
                <span className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full ${billingCycle === 'quarterly' ? 'bg-sky-500/15 text-sky-700' : 'bg-sky-500/10 text-sky-600 border border-sky-500/20'}`}>-17%</span>
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${billingCycle === 'yearly' ? 'bg-sky-600 text-white' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {t.pricing_yearly}
                <span className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full ${billingCycle === 'yearly' ? 'bg-sky-500/15 text-sky-700' : 'bg-sky-500/10 text-sky-600 border border-sky-500/20'}`}>-25%</span>
              </button>
            </div>
          </div>

          <div className="max-w-lg mx-auto relative pt-4">
            <div className="absolute top-0 right-8 z-20">
              <span className="px-4 py-2 rounded-full premium-gradient text-white text-[0.68rem] font-extrabold uppercase tracking-[0.12em] shadow-[0_0_20px_rgba(2,132,199,0.22)]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                {t.pricing_launch_badge}
              </span>
            </div>
            <div className="relative rounded-2xl overflow-hidden p-[1px] bg-gradient-to-br from-sky-400/60 via-sky-300/30 to-sky-500/40">
              <div className="bg-white rounded-[calc(1rem-1px)] p-10 sm:p-12 flex flex-col relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-48 h-48 bg-sky-500/8 blur-[60px] pointer-events-none" />
                <div className="mb-8 relative z-10">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: "'Manrope', sans-serif" }}>PACK PRO</h3>
                    <Star className="h-5 w-5 text-sky-600 fill-sky-500 animate-pulse" />
                  </div>
                  <p className="text-slate-500 text-sm">{t.pricing_pack_desc}</p>
                  <div className="mt-5 flex items-baseline gap-2.5">
                    <span className="text-[3.5rem] font-extrabold text-slate-900" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.04em' }}>{calculatePrice(24)}€</span>
                    <span className="text-slate-400 line-through text-lg">34€</span>
                    <span className="text-slate-500">/mois</span>
                  </div>
                  {billingCycle === 'yearly' && <p className="text-[0.78rem] text-sky-600 mt-2 font-semibold">{t.pricing_billed_yearly}</p>}
                  {billingCycle === 'quarterly' && <p className="text-[0.78rem] text-sky-600 mt-2 font-semibold">{t.pricing_billed_quarterly}</p>}
                </div>

                <ul className="space-y-4 mb-10 flex-1 relative z-10">
                  {[
                    { bold: t.pricing_feat1_bold, rest: t.pricing_feat1_rest },
                    { bold: t.pricing_feat2_bold, rest: t.pricing_feat2_rest },
                    { bold: t.pricing_feat3, rest: '' },
                    { bold: t.pricing_feat4_bold, rest: t.pricing_feat4_rest },
                    { bold: t.pricing_feat5_bold, rest: t.pricing_feat5_rest },
                    { bold: t.pricing_feat6_bold, rest: t.pricing_feat6_rest },
                    { bold: t.pricing_feat7_bold, rest: t.pricing_feat7_rest },
                    { bold: t.pricing_feat8, rest: '' },
                  ].map((feat, idx) => (
                    <li key={idx} className="flex gap-3 text-sm text-slate-700 font-medium">
                      <ShieldCheck className="h-5 w-5 text-sky-600 shrink-0" strokeWidth={1.5} />
                      <span><strong className="text-slate-900">{feat.bold}</strong>{feat.rest}</span>
                    </li>
                  ))}
                </ul>

                <Link to="/register" className="relative z-10 block w-full py-4 rounded-full bg-sky-600 text-white font-bold text-center text-lg transition-all duration-300 hover:bg-sky-500 hover:text-white hover:shadow-[0_0_30px_rgba(2,132,199,0.25)]">
                  {t.pricing_cta}
                </Link>
                <p className="mt-5 text-[0.78rem] text-center text-slate-400">{t.pricing_no_card}</p>
                <p className="mt-3 text-[0.65rem] text-center text-slate-300">{t.pricing_climate}</p>
              </div>
            </div>
          </div>

        </div>
      </motion.section>

      {/* Comparison Modal */}
      {isComparisonOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-[0_40px_80px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setIsComparisonOpen(false)} className="absolute top-5 right-5 p-2.5 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors z-10">
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <PricingComparisonTable isModal={true} />
            <div className="p-6 bg-white sticky bottom-0 text-center border-t border-slate-200">
              <button onClick={() => setIsComparisonOpen(false)} className="px-7 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-full font-bold text-sm transition-colors">
                {t.pricing_close_comparison}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PARTNERS ═══ */}
      <SalesPartnerSection t={t} />

      {/* ═══ FAQ ═══ */}
      <motion.section id="faq" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.8 }} className="py-32 relative border-t border-slate-200 overflow-hidden">
        <div className="pointer-events-none select-none absolute inset-0 hidden lg:block" aria-hidden="true">
          <DoodleBulb className="absolute left-[6%] top-[14%] w-11 text-slate-800/80 -rotate-6" />
          <DoodleStar5 className="absolute left-[12%] top-[40%] w-5 text-sky-400" />
          <DoodleCheck className="absolute left-[7%] top-[64%] w-7 text-sky-500" />
          <DoodleDashes className="absolute left-[5%] top-[84%] w-11 text-slate-300 rotate-6" />
          <DoodleFace className="absolute right-[6%] top-[16%] w-12 text-slate-800/80 rotate-6" />
          <DoodleBurst className="absolute right-[12%] top-[42%] w-6 text-sky-400" />
          <DoodleBubble className="absolute right-[4%] top-[64%] w-14 text-slate-800/80 rotate-3" />
          <DoodleCross className="absolute right-[9%] top-[88%] w-3.5 text-sky-400" />
        </div>
        <div className="mx-auto max-w-3xl px-6 relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-[2.5rem] sm:text-[3rem] font-extrabold text-slate-900 leading-[0.95]" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.04em' }}>{t.faq_title}</h2>
            <p className="text-slate-500 mt-5">{t.faq_subtitle}</p>
          </div>
          {/*
            La FAQ affichée est rendue depuis les mêmes clés ld_faq* que le JSON-LD FAQPage.
            Auparavant, l'affichage (faq*_a1/a2) et le balisage (ld_faq*_a) étaient deux textes
            distincts qui couvraient les mêmes questions : Google demande que le balisage
            FAQPage corresponde au contenu visible, et les deux pouvaient diverger à chaque
            retouche. Une seule source supprime le risque et donne au lecteur les réponses
            complètes. Voir seo/GEO-ANALYSIS.md §4.
          */}
          <div className="space-y-3">
            {([
              [t.ld_faq5_q, t.ld_faq5_a],
              [t.ld_faq6_q, t.ld_faq6_a],
              [t.ld_faq1_q, t.ld_faq1_a],
              [t.ld_faq3_q, t.ld_faq3_a],
              [t.ld_faq4_q, t.ld_faq4_a],
              [t.ld_faq7_q, t.ld_faq7_a],
              [t.ld_faq2_q, t.ld_faq2_a],
            ] as const).map(([q, a]) => (
              <FAQItem key={q} question={q}><p>{a}</p></FAQItem>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ═══ CTA FINAL ═══ */}
      <motion.section initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.8 }} className="relative py-32 overflow-hidden">
        <div className="absolute inset-0 bg-sky-500/5 blur-[100px] rounded-full pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        <div className="pointer-events-none select-none absolute inset-0 hidden md:block" aria-hidden="true">
          <DoodleRocket className="absolute right-[10%] top-[16%] w-14 text-sky-500 rotate-6" />
          <DoodleBurst className="absolute left-[12%] top-[22%] w-7 text-sky-400" />
          <DoodleBolt className="absolute left-[7%] top-[54%] w-6 text-sky-400" />
          <DoodleStar5 className="absolute right-[16%] top-[62%] w-5 text-sky-400" />
          <DoodleHeart className="absolute left-[16%] top-[66%] w-6 text-sky-400" />
          <DoodleZigzag className="absolute left-[7%] top-[38%] w-12 text-slate-300" />
          <DoodleTrophy className="absolute right-[7%] top-[54%] w-11 text-slate-800/80 rotate-6" />
          <DoodleStar5 className="absolute right-[14%] top-[24%] w-5 text-sky-400" />
          <DoodleDashes className="absolute right-[6%] top-[40%] w-11 text-slate-300 -rotate-6" />
        </div>
        <div className="relative mx-auto max-w-4xl px-6 text-center z-10">
          <h2 className="text-[2.5rem] sm:text-[3.5rem] font-extrabold text-slate-900 leading-[0.95] mb-7" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.04em' }}>
            {t.cta_title_line1}<br />{t.cta_title_line2}
          </h2>
          <p className="text-xl text-slate-500 mb-12">{t.cta_subtitle}</p>
          <Link to="/register" className="inline-flex items-center gap-2 w-full sm:w-auto px-10 py-4 rounded-full bg-sky-600 text-white font-extrabold text-lg hover:bg-sky-500 hover:text-white hover:shadow-[0_0_40px_rgba(2,132,199,0.25)] transition-all duration-300" style={{ fontFamily: "'Manrope', sans-serif" }}>
            {t.cta_btn}
            <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
          </Link>
          <p className="mt-7 text-sm text-slate-400">{t.cta_trial}</p>
        </div>
      </motion.section>

      {/* ═══ FOOTER ═══ */}
      </main>
      <footer className="border-t border-slate-200 py-8 pb-20">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-5">
          <img src="/logo-sales.png" alt="CloseOS Logo" className="h-6 w-auto" loading="lazy" width={72} height={24} />
          <div className="flex flex-wrap justify-center gap-4 text-[0.72rem] text-slate-400">
            <span>© 2026 CloseOS.fr</span>
            <span className="hidden sm:inline text-slate-300">·</span>
            <a href="/glossaire" className="hover:text-slate-800 transition-colors">Glossaire</a>
            <a href="/ressources" className="hover:text-slate-800 transition-colors">Ressources</a>
            <a href="/comparatifs" className="hover:text-slate-800 transition-colors">Comparatifs</a>
            <a href="/nouveautes" className="hover:text-slate-800 transition-colors">Nouveautés</a>
            <a href="/mentions-legales" className="hover:text-slate-800 transition-colors">{t.footer_legal}</a>
            <span className="hidden sm:inline text-slate-300">·</span>
            <a href="/cgu" className="hover:text-slate-800 transition-colors">{t.footer_cgu}</a>
            <span className="hidden sm:inline text-slate-300">·</span>
            <a href="/cgv" className="hover:text-slate-800 transition-colors">{t.footer_cgv}</a>
            <span className="hidden sm:inline text-slate-300">·</span>
            <a href="/confidentialite" className="hover:text-slate-800 transition-colors">{t.footer_privacy}</a>
          </div>
          <div className="flex gap-6 text-[0.72rem]">
            <a href="https://www.linkedin.com/in/thomas-shamoev-570885237/" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-800 transition-colors">LinkedIn</a>
            <button onClick={() => setShowContact(true)} className="text-slate-400 hover:text-slate-800 transition-colors flex items-center gap-1">
              <Mail className="size-3" />
              support@closeos.fr
            </button>
          </div>
        </div>
      </footer>
      <SalesContactModal open={showContact} onClose={() => setShowContact(false)} t={t} />

      <div className="fixed bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#f4f2f1] via-[#f4f2f1]/80 to-transparent pointer-events-none z-[80]" />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');

        @keyframes pageEnterFromTop {
          from { opacity: 0; transform: translateY(-60px); }
          to { opacity: 1; transform: translateY(0); }
        }
        /* Seamless integration marquee, track = 4 identical copies,
           translate by exactly ONE copy (-25%) so the loop has no jump. */
        @keyframes intMarqueeLeft {
          from { transform: translateX(0); }
          to { transform: translateX(-25%); }
        }
        @keyframes intMarqueeRight {
          from { transform: translateX(-25%); }
          to { transform: translateX(0); }
        }
        .int-marquee-left { animation: intMarqueeLeft 45s linear infinite; }
        .int-marquee-right { animation: intMarqueeRight 45s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .int-marquee-left, .int-marquee-right { animation: none; }
        }
        .glass-card {
          background: #ffffff;
          border: 1px solid rgba(17, 24, 39, 0.06);
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 14px 34px -16px rgba(15, 23, 42, 0.10);
        }
        .premium-gradient {
          background: linear-gradient(135deg, #38BDF8 0%, #0284C7 100%);
        }
        .emerald-gradient-text {
          background: linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}
