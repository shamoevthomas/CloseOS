import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Briefcase, Calendar, CalendarCheck, CreditCard, BarChart3, Rocket,
  ChevronRight, ChevronLeft, X, ArrowRight, Sparkles, CheckCircle2,
  Target, MousePointerClick, Info, CircleDot,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useLanguage } from '../contexts/LanguageContext'

interface SubStep {
  text: string
  done?: boolean
}

interface Step {
  icon: any
  iconColor: string
  iconBg: string
  title: string
  description: string
  subSteps: SubStep[]
  tip: string | null
  targetPage: string | null
  actionLabel: string | null
  routine?: string[]
  support?: { email: string; guideUrl: string }
}

const STEPS_FR: Step[] = [
  {
    icon: Sparkles, iconColor: 'text-emerald-400', iconBg: 'bg-emerald-500/10',
    title: 'Bienvenue sur CloseOS Sales !',
    description: 'Votre cockpit de closer indépendant. Ce guide vous accompagne pour configurer votre espace en quelques minutes.',
    subSteps: [],
    tip: 'CloseOS vous fait gagner jusqu\'à 1h30 par jour en éliminant les tâches admin.',
    targetPage: null, actionLabel: null,
  },
  {
    icon: Briefcase, iconColor: 'text-amber-400', iconBg: 'bg-amber-500/10',
    title: 'Créez votre première offre',
    description: 'Sans offre, impossible d\'assigner des prospects, calculer vos commissions ou générer des factures.',
    subSteps: [
      { text: 'Cliquez sur "+ Nouvelle offre"' },
      { text: 'Renseignez le nom du produit/service' },
      { text: 'Définissez le prix et votre taux de commission' },
      { text: 'Ajoutez le nom de l\'infopreneur (client)' },
    ],
    tip: 'Une offre = un produit que vous vendez pour un infopreneur. Créez-en une par client.',
    targetPage: '/offers', actionLabel: 'Aller dans Offres',
  },
  {
    icon: Calendar, iconColor: 'text-emerald-400', iconBg: 'bg-emerald-500/10',
    title: 'Connectez Google Calendar',
    description: 'Synchronisez votre agenda pour voir vos événements et créer des RDV avec lien Google Meet automatique.',
    subSteps: [
      { text: 'Cliquez sur "Synchroniser Google" en haut de la page' },
      { text: 'Autorisez l\'accès à votre Google Calendar' },
      { text: 'Vos événements se synchronisent automatiquement' },
    ],
    tip: 'La synchronisation couvre 1 mois passé et 3 mois dans le futur.',
    targetPage: '/agenda', actionLabel: 'Aller dans Agenda',
  },
  {
    icon: CalendarCheck, iconColor: 'text-purple-400', iconBg: 'bg-purple-500/10',
    title: 'Configurez vos Rendez-vous',
    description: 'Connectez Cal.com pour gérer vos créneaux et permettre à vos prospects de réserver directement.',
    subSteps: [
      { text: 'Allez dans la page Rendez-vous' },
      { text: 'Connectez votre compte Cal.com' },
      { text: 'Configurez vos types de RDV et disponibilités sur Cal.com' },
      { text: 'Partagez votre lien de booking Cal.com à vos prospects' },
    ],
    tip: 'Cal.com gère automatiquement les créneaux, les rappels et la synchronisation avec votre agenda.',
    targetPage: '/rendez-vous', actionLabel: 'Aller dans Rendez-vous',
  },
  {
    icon: CreditCard, iconColor: 'text-emerald-400', iconBg: 'bg-emerald-500/10',
    title: 'Configurez la Facturation',
    description: 'Connectez Stripe Connect pour recevoir vos paiements et ajoutez vos moyens de paiement.',
    subSteps: [
      { text: 'Cliquez sur "Connecter Stripe" pour recevoir vos paiements' },
      { text: 'Ajoutez vos coordonnées bancaires (IBAN, PayPal, Revolut...)' },
      { text: 'Renseignez vos informations de facturation (SIRET, adresse...)' },
    ],
    tip: 'Avec Stripe Connect actif, chaque facture inclut un lien de paiement automatique.',
    targetPage: '/factures', actionLabel: 'Aller dans Factures',
  },
  {
    icon: BarChart3, iconColor: 'text-violet-400', iconBg: 'bg-violet-500/10',
    title: 'Configurez vos KPI',
    description: 'Importez vos KPI pour suivre votre performance et piloter votre activité au quotidien.',
    subSteps: [
      { text: 'Cliquez sur le bouton "Configurer" en haut de la page' },
      { text: 'Importez vos KPI depuis la configuration' },
    ],
    tip: 'Une fois vos KPI importés, vous pourrez suivre votre progression en temps réel.',
    targetPage: '/kpi', actionLabel: 'Aller dans KPI',
  },
  {
    icon: Rocket, iconColor: 'text-emerald-400', iconBg: 'bg-emerald-500/10',
    title: 'Vous êtes prêt !',
    description: 'Votre espace est configuré. Voici votre routine quotidienne recommandée :',
    subSteps: [], tip: null,
    targetPage: '/dashboard', actionLabel: 'Commencer',
    routine: [
      'Matin — Dashboard pour voir vos RDV et KPIs du jour',
      'Préparation — Pipeline pour relire les fiches prospects',
      'Appels — Cockpit avec scripts et ressources affichés auto',
      'Après chaque call — Mise à jour automatique : stage + notes + facture + KPI en temps réel',
      'Fin de journée — KPI pour suivre votre progression',
    ],
    support: { email: 'support@closeos.fr', guideUrl: 'https://www.notion.so/Guide-d-onboarding-CloseOS-Sales-334aef2e488f8172bbdffcfeedf88fad' },
  },
]

const STEPS_EN: Step[] = [
  {
    icon: Sparkles, iconColor: 'text-emerald-400', iconBg: 'bg-emerald-500/10',
    title: 'Welcome to CloseOS Sales!',
    description: 'Your independent closer cockpit. This guide will help you set up your workspace in a few minutes.',
    subSteps: [],
    tip: 'CloseOS saves you up to 1.5 hours per day by eliminating admin tasks.',
    targetPage: null, actionLabel: null,
  },
  {
    icon: Briefcase, iconColor: 'text-amber-400', iconBg: 'bg-amber-500/10',
    title: 'Create your first offer',
    description: 'Without an offer, you cannot assign prospects, calculate commissions, or generate invoices.',
    subSteps: [
      { text: 'Click on "+ New offer"' },
      { text: 'Enter the product/service name' },
      { text: 'Set the price and your commission rate' },
      { text: 'Add the client\'s name' },
    ],
    tip: 'An offer = a product you sell for a client. Create one per client.',
    targetPage: '/offers', actionLabel: 'Go to Offers',
  },
  {
    icon: Calendar, iconColor: 'text-emerald-400', iconBg: 'bg-emerald-500/10',
    title: 'Connect Google Calendar',
    description: 'Sync your calendar to see events and create appointments with automatic Google Meet links.',
    subSteps: [
      { text: 'Click "Sync Google" at the top of the page' },
      { text: 'Authorize access to your Google Calendar' },
      { text: 'Your events sync automatically' },
    ],
    tip: 'Sync covers 1 month in the past and 3 months in the future.',
    targetPage: '/agenda', actionLabel: 'Go to Calendar',
  },
  {
    icon: CalendarCheck, iconColor: 'text-purple-400', iconBg: 'bg-purple-500/10',
    title: 'Set up your Appointments',
    description: 'Connect Cal.com to manage your slots and let prospects book directly.',
    subSteps: [
      { text: 'Go to the Appointments page' },
      { text: 'Connect your Cal.com account' },
      { text: 'Configure your appointment types and availability on Cal.com' },
      { text: 'Share your Cal.com booking link with prospects' },
    ],
    tip: 'Cal.com automatically manages slots, reminders, and calendar sync.',
    targetPage: '/rendez-vous', actionLabel: 'Go to Appointments',
  },
  {
    icon: CreditCard, iconColor: 'text-emerald-400', iconBg: 'bg-emerald-500/10',
    title: 'Set up Invoicing',
    description: 'Connect Stripe Connect to receive payments and add your payment methods.',
    subSteps: [
      { text: 'Click "Connect Stripe" to receive payments' },
      { text: 'Add your bank details (IBAN, PayPal, Revolut...)' },
      { text: 'Enter your billing information (SIRET, address...)' },
    ],
    tip: 'With Stripe Connect active, each invoice includes an automatic payment link.',
    targetPage: '/factures', actionLabel: 'Go to Invoices',
  },
  {
    icon: BarChart3, iconColor: 'text-violet-400', iconBg: 'bg-violet-500/10',
    title: 'Set up your KPIs',
    description: 'Import your KPIs to track your performance and manage your activity daily.',
    subSteps: [
      { text: 'Click the "Configure" button at the top of the page' },
      { text: 'Import your KPIs from the configuration' },
    ],
    tip: 'Once your KPIs are imported, you can track your progress in real time.',
    targetPage: '/kpi', actionLabel: 'Go to KPIs',
  },
  {
    icon: Rocket, iconColor: 'text-emerald-400', iconBg: 'bg-emerald-500/10',
    title: "You're all set!",
    description: 'Your workspace is configured. Here is your recommended daily routine:',
    subSteps: [], tip: null,
    targetPage: '/dashboard', actionLabel: 'Get started',
    routine: [
      'Morning — Dashboard to see your appointments and daily KPIs',
      'Preparation — Pipeline to review prospect profiles',
      'Calls — Cockpit with auto-displayed scripts and resources',
      'After each call — Auto update: stage + notes + invoice + KPI in real time',
      'End of day — KPIs to track your progress',
    ],
    support: { email: 'support@closeos.fr', guideUrl: 'https://www.notion.so/Guide-d-onboarding-CloseOS-Sales-334aef2e488f8172bbdffcfeedf88fad' },
  },
]

interface OnboardingTutorialProps {
  onComplete: () => void
}

export function OnboardingTutorial({ onComplete }: OnboardingTutorialProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { lang } = useLanguage()
  const [step, setStep] = useState(0)
  const [minimized, setMinimized] = useState(false)

  const STEPS = lang === 'fr' ? STEPS_FR : STEPS_EN
  const current = STEPS[step]
  const isFirst = step === 0
  const isLast = step === STEPS.length - 1

  // Show "you're here" badge when on target page (no auto-minimize)

  const handleNext = () => {
    if (isLast) {
      onComplete()
    } else {
      setStep(s => s + 1)
      setMinimized(false)
    }
  }

  const handlePrev = () => {
    if (!isFirst) {
      setStep(s => s - 1)
      setMinimized(false)
    }
  }

  const handleAction = () => {
    if (current.targetPage) {
      navigate(current.targetPage)
      setMinimized(true)
    }
  }

  // Minimized floating badge (bottom-right)
  if (minimized) {
    return (
      <div className="fixed bottom-6 right-6 z-[200] animate-in slide-in-from-bottom-4 duration-300">
        <button
          onClick={() => setMinimized(false)}
          className="group flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-white/[0.03] px-5 py-3.5 shadow-[0_20px_40px_rgba(0,0,0,0.2)] backdrop-blur-2xl hover:border-emerald-500/50 transition-all"
        >
          <div className="relative">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20">
              <current.icon className={cn('h-4.5 w-4.5', current.iconColor)} />
            </div>
            <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-black">
              {step + 1}
            </div>
          </div>
          <div className="text-left">
            <p className="text-xs font-bold text-white">{current.title}</p>
            <p className="text-[10px] text-white/40">{lang === 'fr' ? 'Cliquez pour reprendre le guide' : 'Click to resume the guide'}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-white/40 group-hover:text-white transition-colors" />
        </button>
      </div>
    )
  }

  // Full modal
  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg mx-4 mb-4 sm:mb-0 rounded-3xl border border-white/[0.08] bg-[#1a1a1a] shadow-[0_20px_40px_rgba(0,0,0,0.2)] backdrop-blur-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-white/5">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500 ease-out"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        {/* Top actions */}
        <div className="absolute top-5 right-5 flex items-center gap-2 z-10">
          {current.targetPage && (
            <button
              onClick={() => setMinimized(true)}
              className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white/40 hover:text-white hover:bg-white/5 transition-colors uppercase tracking-wider"
            >
              {lang === 'fr' ? 'Minimiser' : 'Minimize'}
            </button>
          )}
          <button
            onClick={onComplete}
            className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
            title={lang === 'fr' ? "Fermer le guide" : "Close guide"}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 pt-6">
          {/* Step counter */}
          <div className="flex items-center gap-2 mb-6">
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-[0.2em]">
              {lang === 'fr' ? `Étape ${step + 1} sur ${STEPS.length}` : `Step ${step + 1} of ${STEPS.length}`}
            </p>
            {current.targetPage && location.pathname === current.targetPage && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-[10px] font-bold text-emerald-400">
                <CircleDot className="h-3 w-3" />
                {lang === 'fr' ? 'Vous y êtes' : "You're here"}
              </span>
            )}
          </div>

          {/* Icon */}
          <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center mb-5', current.iconBg)}>
            <current.icon className={cn('h-7 w-7', current.iconColor)} />
          </div>

          {/* Title */}
          <h2 className="text-2xl font-extrabold text-white mb-3 tracking-tight">{current.title}</h2>

          {/* Description */}
          <p className="text-sm text-white/40 leading-relaxed mb-4">{current.description}</p>

          {/* Sub-steps (concrete actions) */}
          {current.subSteps.length > 0 && (
            <div className="rounded-xl bg-white/5 border border-white/[0.08] p-4 mb-5">
              <div className="flex items-center gap-2 mb-3">
                <MousePointerClick className="h-3.5 w-3.5 text-emerald-400" />
                <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">{lang === 'fr' ? 'À faire sur cette page' : 'To do on this page'}</p>
              </div>
              <div className="space-y-2.5">
                {current.subSteps.map((sub, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-white/60 mt-0.5">
                      {i + 1}
                    </div>
                    <p className="text-sm text-white/60 leading-relaxed">{sub.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Routine list (last step) */}
          {current.routine && (
            <div className="space-y-2.5 mb-5">
              {current.routine.map((item, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-white/60 leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          )}

          {/* Support & Guide */}
          {current.support && (
            <div className="rounded-xl bg-white/5 border border-white/[0.08] p-4 mb-5 space-y-2.5">
              <div className="flex items-center gap-2.5">
                <Info className="h-4 w-4 text-white/40 shrink-0" />
                <p className="text-xs text-white/60">{lang === 'fr' ? "Besoin d'aide ? Contactez-nous : " : 'Need help? Contact us: '}<a href={`mailto:${current.support.email}`} className="text-emerald-400 hover:text-emerald-300 font-bold">{current.support.email}</a></p>
              </div>
              <div className="flex items-center gap-2.5">
                <ArrowRight className="h-4 w-4 text-white/40 shrink-0" />
                <a href={current.support.guideUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-400 hover:text-emerald-300 font-bold">{lang === 'fr' ? "Consultez le guide d'onboarding complet" : 'View the complete onboarding guide'}</a>
              </div>
            </div>
          )}

          {/* Tip */}
          {current.tip && (
            <div className="flex items-start gap-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 px-4 py-3 mb-6">
              <Info className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-300/80 leading-relaxed">{current.tip}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Back button */}
            {!isFirst && (
              <button
                onClick={handlePrev}
                className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}

            {/* Navigate to page */}
            {current.targetPage && (
              <button
                onClick={handleAction}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold transition-colors"
              >
                <Target className="h-4 w-4" />
                {current.actionLabel}
              </button>
            )}

            {/* Next / Skip / Finish */}
            <button
              onClick={handleNext}
              className={cn(
                'flex items-center justify-center gap-2 px-5 py-3 rounded-full text-sm font-bold transition-colors',
                current.targetPage
                  ? 'bg-white/[0.03] border border-white/[0.08] text-white/80 hover:bg-white/10'
                  : 'flex-1 bg-emerald-500 hover:bg-emerald-400 text-black'
              )}
            >
              {isLast ? (lang === 'fr' ? 'Terminer' : 'Finish') : current.targetPage ? (lang === 'fr' ? 'Passer' : 'Skip') : (lang === 'fr' ? 'Suivant' : 'Next')}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Skip all link */}
          {!isLast && (
            <button
              onClick={onComplete}
              className="w-full mt-4 text-center text-[11px] text-white/30 hover:text-white/60 transition-colors"
            >
              {lang === 'fr' ? 'Passer tout le guide' : 'Skip entire guide'}
            </button>
          )}
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-1.5 pb-6">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => { setStep(i); setMinimized(false) }}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i === step ? 'w-6 bg-emerald-500' : i < step ? 'w-1.5 bg-emerald-500/50' : 'w-1.5 bg-white/10'
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
