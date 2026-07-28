import { useState, useEffect } from 'react'
import { X, CheckCircle2, XCircle, Clock, FileText, Calendar } from 'lucide-react'
import { cn } from '../lib/utils'
import { useLanguage } from '../contexts/LanguageContext'
import { callSummaryTranslations } from '../i18n/translations'

interface CallSummaryModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CallSummaryData) => void
  prospectName: string
  offerPrice?: number
}

export interface CallSummaryData {
  outcome: 'won' | 'lost' | 'followup'
  notes: string
  followupReason?: string
  followupReasonOther?: string
  followupDate?: string
  // Données financières (si outcome === 'won')
  paymentType?: 'comptant' | 'installments'
  installmentsCount?: number
  installmentsFrequency?: 'mensuel' | 'trimestriel'
  commissionRate?: number
  commissionSpread?: boolean
}

const getFollowupReasons = (lang: 'fr' | 'en') => lang === 'fr'
  ? ['Pas le bon moment', 'Doit consulter un décideur', 'Budget à valider', 'Besoin de plus d\'informations', 'Autre']
  : ['Bad timing', 'Needs to consult a decision-maker', 'Budget to validate', 'Needs more information', 'Other']

const getOutcomes = (lang: 'fr' | 'en') => [
  {
    id: 'won' as const,
    label: lang === 'fr' ? 'Vente Gagnee' : 'Won',
    description: lang === 'fr' ? 'Le prospect a accepté l\'offre' : 'The prospect accepted the offer',
    icon: CheckCircle2,
    color: 'emerald',
    bgColor: 'bg-sky-500/10',
    borderColor: 'border-sky-500/30',
    textColor: 'text-sky-600 dark:text-sky-400',
    hoverBg: 'hover:bg-sky-500/20'
  },
  {
    id: 'followup' as const,
    label: 'Follow Up',
    description: lang === 'fr' ? 'Nécessite un suivi ultérieur' : 'Requires further follow-up',
    icon: Clock,
    color: 'orange',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    textColor: 'text-orange-600',
    hoverBg: 'hover:bg-orange-500/20'
  },
  {
    id: 'lost' as const,
    label: lang === 'fr' ? 'Perdu' : 'Lost',
    description: lang === 'fr' ? 'Le prospect a refusé l\'offre' : 'The prospect declined the offer',
    icon: XCircle,
    color: 'red',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    textColor: 'text-red-600',
    hoverBg: 'hover:bg-red-500/20'
  }
]

export function CallSummaryModal({ isOpen, onClose, onSubmit, prospectName, offerPrice = 0 }: CallSummaryModalProps) {
  const { lang } = useLanguage()
  const t = callSummaryTranslations[lang]
  const outcomes = getOutcomes(lang)
  const followupReasons = getFollowupReasons(lang)
  const otherLabel = lang === 'fr' ? 'Autre' : 'Other'
  const [selectedOutcome, setSelectedOutcome] = useState<'won' | 'lost' | 'followup' | null>(null)
  const [notes, setNotes] = useState('')
  const [followupReason, setFollowupReason] = useState('')
  const [followupReasonOther, setFollowupReasonOther] = useState('')
  const [followupDate, setFollowupDate] = useState('')

  // États financiers (vente gagnée)
  const [paymentType, setPaymentType] = useState<'comptant' | 'installments'>('comptant')
  const [installmentsCount, setInstallmentsCount] = useState(3)
  const [installmentsFrequency, setInstallmentsFrequency] = useState<'mensuel' | 'trimestriel'>('mensuel')
  const [commissionRate, setCommissionRate] = useState(10)
  const [commissionSpread, setCommissionSpread] = useState(false)

  // Calculs automatiques
  const amountPerInstallment = paymentType === 'installments' && installmentsCount > 0
    ? offerPrice / installmentsCount
    : 0

  const totalCommission = (offerPrice * commissionRate) / 100
  const commissionPerInstallment = commissionSpread && paymentType === 'installments' && installmentsCount > 0
    ? totalCommission / installmentsCount
    : 0

  // Validation: pour Follow Up, les champs motif et date sont obligatoires
  // Si motif == "Autre", le champ "Précisez" est aussi obligatoire
  // Pour Vente Gagnée, le taux de commission est obligatoire
  const isFormValid = () => {
    if (!selectedOutcome) return false
    if (selectedOutcome === 'followup') {
      const hasReason = followupReason !== ''
      const hasDate = followupDate !== ''
      const hasOtherDetails = followupReason === otherLabel ? followupReasonOther.trim() !== '' : true
      return hasReason && hasDate && hasOtherDetails
    }
    if (selectedOutcome === 'won') {
      return commissionRate > 0
    }
    return true
  }

  const handleSubmit = () => {
    if (selectedOutcome && isFormValid()) {
      onSubmit({
        outcome: selectedOutcome,
        notes,
        followupReason: selectedOutcome === 'followup' ? followupReason : undefined,
        followupReasonOther: selectedOutcome === 'followup' && followupReason === otherLabel ? followupReasonOther : undefined,
        followupDate: selectedOutcome === 'followup' ? followupDate : undefined,
        // Données financières si vente gagnée
        paymentType: selectedOutcome === 'won' ? paymentType : undefined,
        installmentsCount: selectedOutcome === 'won' && paymentType === 'installments' ? installmentsCount : undefined,
        installmentsFrequency: selectedOutcome === 'won' && paymentType === 'installments' ? installmentsFrequency : undefined,
        commissionRate: selectedOutcome === 'won' ? commissionRate : undefined,
        commissionSpread: selectedOutcome === 'won' && paymentType === 'installments' ? commissionSpread : undefined
      })
      // Reset form
      setSelectedOutcome(null)
      setNotes('')
      setFollowupReason('')
      setFollowupReasonOther('')
      setFollowupDate('')
      setPaymentType('comptant')
      setInstallmentsCount(3)
      setInstallmentsFrequency('mensuel')
      setCommissionRate(10)
      setCommissionSpread(false)
      onClose()
    }
  }

  const handleClose = () => {
    setSelectedOutcome(null)
    setNotes('')
    setFollowupReason('')
    setFollowupReasonOther('')
    setFollowupDate('')
    setPaymentType('comptant')
    setInstallmentsCount(3)
    setInstallmentsFrequency('mensuel')
    setCommissionRate(10)
    setCommissionSpread(false)
    onClose()
  }

  // Bloquer le scroll du body quand la modale est ouverte
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
    }

    // Cleanup au démontage
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md transition-opacity"
        onClick={handleClose}
      />

      {/* Modal - Structure Flexbox Stricte */}
      <div className="relative w-full max-w-2xl mx-4">
        <div className="flex flex-col rounded-2xl bg-white dark:bg-[#1a1a1a] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_14px_34px_-16px_rgba(15,23,42,0.10)] border border-slate-200 dark:border-white/10 max-h-[90vh]">
          {/* Header - Ne s'écrase jamais */}
          <div className="flex-shrink-0 border-b border-slate-200 dark:border-white/10 px-6 py-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t.title}</h2>
                <p className="mt-1 text-sm text-slate-400 dark:text-neutral-500">
                  {lang === 'fr' ? 'Qualifiez votre appel avec' : 'Qualify your call with'} <span className="font-semibold text-slate-900 dark:text-white">{prospectName}</span>
                </p>
              </div>
              <button
                onClick={handleClose}
                className="rounded-lg p-2 text-slate-400 dark:text-neutral-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Body - Zone scrollable avec min-h-0 */}
          <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-6">
            {/* Outcome Selection */}
            <div>
              <label className="mb-3 block text-sm font-semibold text-slate-900 dark:text-white">
                {t.outcome} <span className="text-red-600">*</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                {outcomes.map((outcome) => {
                  const Icon = outcome.icon
                  const isSelected = selectedOutcome === outcome.id

                  return (
                    <button
                      key={outcome.id}
                      onClick={() => setSelectedOutcome(outcome.id)}
                      className={cn(
                        'group relative flex flex-col items-center gap-3 rounded-xl border-2 p-4 transition-all',
                        isSelected
                          ? `${outcome.bgColor} ${outcome.borderColor} shadow-lg`
                          : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:border-slate-200 hover:bg-slate-100'
                      )}
                    >
                      <div className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-full transition-all',
                        isSelected
                          ? outcome.bgColor
                          : 'bg-slate-100 dark:bg-white/10 group-hover:bg-slate-100'
                      )}>
                        <Icon className={cn(
                          'h-6 w-6 transition-colors',
                          isSelected
                            ? outcome.textColor
                            : 'text-slate-400 dark:text-neutral-500 group-hover:text-slate-500'
                        )} />
                      </div>
                      <div className="text-center">
                        <p className={cn(
                          'text-sm font-semibold transition-colors',
                          isSelected ? outcome.textColor : 'text-slate-500 dark:text-neutral-400 group-hover:text-slate-900'
                        )}>
                          {outcome.label}
                        </p>
                        <p className="mt-1 text-xs text-slate-400 dark:text-neutral-500">
                          {outcome.description}
                        </p>
                      </div>

                      {/* Selected indicator */}
                      {isSelected && (
                        <div className="absolute -top-2 -right-2">
                          <div className={cn('rounded-full p-1', outcome.bgColor, outcome.borderColor, 'border-2')}>
                            <CheckCircle2 className={cn('h-4 w-4', outcome.textColor)} />
                          </div>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Won Fields - Plan de Financement */}
            {selectedOutcome === 'won' && (
              <div className="space-y-4 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
                <p className="text-sm font-semibold text-sky-600 dark:text-sky-400">
                  {lang === 'fr' ? 'Plan de Financement' : 'Payment Plan'}
                </p>

                {/* Prix de l'offre (read-only) */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-900 dark:text-white">
                    {lang === 'fr' ? 'Prix de l\'offre' : 'Offer price'}
                  </label>
                  <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-4 py-2.5 text-sm text-slate-400 dark:text-neutral-500">
                    {offerPrice.toFixed(2)} €
                  </div>
                </div>

                {/* Type de paiement */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-900 dark:text-white">
                    {lang === 'fr' ? 'Mode de paiement' : 'Payment method'} <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value as 'comptant' | 'installments')}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:border-sky-500 focus:outline-none transition-all"
                  >
                    <option value="comptant">{lang === 'fr' ? 'Comptant' : 'Upfront'}</option>
                    <option value="installments">{lang === 'fr' ? 'En plusieurs fois' : 'Installments'}</option>
                  </select>
                </div>

                {/* Champs conditionnels si paiement en plusieurs fois */}
                {paymentType === 'installments' && (
                  <div className="space-y-4 pl-4 border-l-2 border-sky-500/30">
                    <div className="grid grid-cols-2 gap-3">
                      {/* Nombre de mensualités */}
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-900 dark:text-white">
                          {lang === 'fr' ? 'Nombre d\'échéances' : 'Number of installments'}
                        </label>
                        <input
                          type="number"
                          min="2"
                          max="12"
                          value={installmentsCount}
                          onChange={(e) => setInstallmentsCount(parseInt(e.target.value) || 2)}
                          className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:border-sky-500 focus:outline-none transition-all"
                        />
                      </div>

                      {/* Fréquence */}
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-900 dark:text-white">
                          {lang === 'fr' ? 'Fréquence' : 'Frequency'}
                        </label>
                        <select
                          value={installmentsFrequency}
                          onChange={(e) => setInstallmentsFrequency(e.target.value as 'mensuel' | 'trimestriel')}
                          className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:border-sky-500 focus:outline-none transition-all"
                        >
                          <option value="mensuel">{lang === 'fr' ? 'Mensuel' : 'Monthly'}</option>
                          <option value="trimestriel">{lang === 'fr' ? 'Trimestriel' : 'Quarterly'}</option>
                        </select>
                      </div>
                    </div>

                    {/* Calcul affiché */}
                    <div className="rounded-lg bg-sky-500/10 border border-sky-500/20 p-3">
                      <p className="text-sm font-medium text-sky-600 dark:text-sky-400">
                        {lang === 'fr' ? `💰 Montant par échéance : ${amountPerInstallment.toFixed(2)} €` : `💰 Amount per installment: ${amountPerInstallment.toFixed(2)} €`}
                      </p>
                    </div>
                  </div>
                )}

                {/* Section Commission */}
                <div className="mt-4 pt-4 border-t border-sky-500/20">
                  <p className="text-sm font-semibold text-sky-600 dark:text-sky-400 mb-3">
                    {lang === 'fr' ? 'Votre Commission' : 'Your Commission'}
                  </p>

                  {/* Taux de commission */}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-900 dark:text-white">
                      {lang === 'fr' ? 'Taux de commission (%)' : 'Commission rate (%)'} <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={commissionRate}
                      onChange={(e) => setCommissionRate(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:border-sky-500 focus:outline-none transition-all"
                      placeholder="Ex: 10"
                    />
                  </div>

                  {/* Toggle commission étalée (uniquement si paiement en plusieurs fois) */}
                  {paymentType === 'installments' && (
                    <div className="mt-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={commissionSpread}
                            onChange={(e) => setCommissionSpread(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-100 dark:bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-slate-200 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                        </div>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {lang === 'fr' ? 'Commission étalée sur les échéances' : 'Commission spread across installments'}
                        </span>
                      </label>
                    </div>
                  )}

                  {/* Calcul de la commission */}
                  <div className="mt-3 rounded-lg bg-sky-500/10 border border-sky-500/20 p-3">
                    {commissionSpread && paymentType === 'installments' ? (
                      <p className="text-sm font-medium text-sky-600 dark:text-sky-400">
                        {lang === 'fr' ? `💵 Commission par échéance : ${commissionPerInstallment.toFixed(2)} € / ${installmentsFrequency === 'mensuel' ? 'mois' : 'trimestre'}` : `💵 Commission per installment: ${commissionPerInstallment.toFixed(2)} € / ${installmentsFrequency === 'mensuel' ? 'month' : 'quarter'}`}
                      </p>
                    ) : (
                      <p className="text-sm font-medium text-sky-600 dark:text-sky-400">
                        {lang === 'fr' ? `💵 Commission totale à percevoir : ${totalCommission.toFixed(2)} €` : `💵 Total commission: ${totalCommission.toFixed(2)} €`}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Follow Up Fields - Affichage conditionnel */}
            {selectedOutcome === 'followup' && (
              <div className="space-y-4 rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
                <p className="text-sm font-semibold text-orange-600">
                  {lang === 'fr' ? 'Informations de suivi' : 'Follow-up information'}
                </p>

                {/* Motif du Follow Up */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-900 dark:text-white">
                    {lang === 'fr' ? 'Motif du report' : 'Postponement reason'} <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={followupReason}
                    onChange={(e) => {
                      setFollowupReason(e.target.value)
                      // Reset le champ "Autre" si on change de motif
                      if (e.target.value !== otherLabel) {
                        setFollowupReasonOther('')
                      }
                    }}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:border-orange-500 focus:outline-none transition-all"
                  >
                    <option value="">{lang === 'fr' ? 'Sélectionnez un motif' : 'Select a reason'}</option>
                    {followupReasons.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>

                  {/* Champ conditionnel "Précisez" si motif == "Autre" */}
                  {followupReason === otherLabel && (
                    <div className="mt-3">
                      <label className="mb-2 block text-sm font-medium text-slate-900 dark:text-white">
                        {lang === 'fr' ? 'Précisez le motif' : 'Specify the reason'} <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={followupReasonOther}
                        onChange={(e) => setFollowupReasonOther(e.target.value)}
                        placeholder={lang === 'fr' ? 'Ex: Indisponibilité exceptionnelle...' : 'E.g.: Exceptional unavailability...'}
                        className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:border-orange-500 focus:outline-none transition-all"
                      />
                    </div>
                  )}
                </div>

                {/* Date de reprogrammation */}
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
                    <Calendar className="h-4 w-4" />
                    {lang === 'fr' ? 'Date de reprogrammation' : 'Reschedule date'} <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={followupDate}
                    onChange={(e) => setFollowupDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:border-orange-500 focus:outline-none transition-all"
                  />
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <FileText className="h-4 w-4" />
                {t.notes}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t.notes_placeholder}
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:border-sky-500 focus:outline-none transition-all resize-none"
                rows={6}
              />
              <p className="mt-2 text-xs text-slate-400 dark:text-neutral-500">
                {lang === 'fr' ? 'Ces notes seront ajoutées à la fiche prospect' : 'These notes will be added to the prospect record'}
              </p>
            </div>
          </div>

          {/* Footer - Toujours visible en bas */}
          <div className="flex-shrink-0 border-t border-slate-200 dark:border-white/10 px-6 py-4 bg-black/20">
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={handleClose}
                className="rounded-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-neutral-300 transition-all hover:bg-slate-100"
              >
                {t.skip}
              </button>
              <button
                onClick={handleSubmit}
                disabled={!isFormValid()}
                className={cn(
                  'rounded-full px-6 py-2.5 text-sm font-semibold transition-all',
                  isFormValid()
                    ? 'bg-sky-600 text-white hover:bg-sky-600 shadow-lg shadow-sky-500/20'
                    : 'bg-slate-100 dark:bg-white/10 text-slate-400 dark:text-neutral-500 cursor-not-allowed opacity-50'
                )}
              >
                {t.submit}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
