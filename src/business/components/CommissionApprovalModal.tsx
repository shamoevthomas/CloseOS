import { useEffect, useState } from 'react'
import { X, Check, XCircle, Award, Loader2, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessLang } from '../i18n/BusinessLangContext'
import { decideCommissionApproval, type CommissionApprovalRecord } from '../services/commissionApproval'
import { cn } from '../../lib/utils'

interface CommissionApprovalModalProps {
  approvalId: string
  onClose: () => void
  onDecided?: () => void
}

interface ApprovalDetails extends CommissionApprovalRecord {
  closer_first_name?: string | null
  closer_last_name?: string | null
  closer_user_id?: string | null
  prospect_name?: string | null
  prospect_offer?: string | null
}

export function CommissionApprovalModal({ approvalId, onClose, onDecided }: CommissionApprovalModalProps) {
  const { t } = useBusinessLang()
  const { user } = useBusinessAuth()
  const [details, setDetails] = useState<ApprovalDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [submitting, setSubmitting] = useState<'approve' | 'reject' | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const { data: approval } = await supabase
        .from('commission_approvals')
        .select('*')
        .eq('id', approvalId)
        .maybeSingle()

      if (!approval || cancelled) {
        setLoading(false)
        return
      }

      const { data: closer } = await supabase
        .from('business_team_members')
        .select('first_name, last_name, user_id')
        .eq('id', approval.closer_id)
        .maybeSingle()

      const { data: prospect } = await supabase
        .from('business_prospects')
        .select('contact, firstName, lastName, offer')
        .eq('id', approval.prospect_id)
        .maybeSingle()

      if (!cancelled) {
        setDetails({
          ...(approval as CommissionApprovalRecord),
          closer_first_name: closer?.first_name,
          closer_last_name: closer?.last_name,
          closer_user_id: closer?.user_id,
          prospect_name:
            prospect?.contact ||
            `${prospect?.firstName || ''} ${prospect?.lastName || ''}`.trim() ||
            null,
          prospect_offer: prospect?.offer,
        })
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [approvalId])

  const handleDecide = async (decision: 'approved' | 'rejected') => {
    if (!details || !user?.id) return
    if (decision === 'rejected' && !showRejectInput) {
      setShowRejectInput(true)
      return
    }
    setSubmitting(decision === 'approved' ? 'approve' : 'reject')
    const ok = await decideCommissionApproval(
      details.id,
      details.prospect_id,
      decision,
      user.id,
      decision === 'rejected' ? rejectionReason : undefined,
      {
        closerUserId: details.closer_user_id || undefined,
        closerName: `${details.closer_first_name || ''} ${details.closer_last_name || ''}`.trim() || undefined,
        prospectName: details.prospect_name || undefined,
      }
    )
    setSubmitting(null)
    if (ok) {
      onDecided?.()
      onClose()
    }
  }

  const standardCommission = details ? (details.sale_amount * details.standard_commission_rate) / 100 : 0
  const customCommission =
    details && details.custom_commission_rate != null
      ? (details.sale_amount * details.custom_commission_rate) / 100
      : standardCommission
  const diff = customCommission - standardCommission
  const closerFullName = details
    ? `${details.closer_first_name || ''} ${details.closer_last_name || ''}`.trim() || 'Closer'
    : ''

  const alreadyDecided = details && details.status !== 'pending'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-neutral-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-stone-200 dark:border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-500/10">
              <Award className="h-5 w-5 text-amber-600" />
            </div>
            <h2 className="text-lg font-bold text-stone-900 dark:text-white font-['Manrope']">{t.approval_modal_title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-stone-400 hover:bg-stone-100 dark:hover:bg-white/5 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
            </div>
          ) : !details ? (
            <p className="text-center text-sm text-stone-500 py-10">Demande introuvable.</p>
          ) : (
            <>
              {alreadyDecided && (
                <div className={cn(
                  'flex items-center gap-2 rounded-xl border p-3 text-sm',
                  details.status === 'approved'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-red-200 bg-red-50 text-red-700'
                )}>
                  <AlertCircle className="h-4 w-4" />
                  {details.status === 'approved' ? t.custom_commission_status_approved : t.custom_commission_status_rejected}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <InfoCard label={t.approval_modal_closer} value={closerFullName} />
                <InfoCard label={t.approval_modal_prospect} value={details.prospect_name || '—'} sub={details.prospect_offer || undefined} />
                <InfoCard label={t.approval_modal_amount} value={`${details.sale_amount.toFixed(2)} €`} highlight />
                <InfoCard label={t.approval_modal_standard_rate} value={`${details.standard_commission_rate}%`} />
              </div>

              {details.custom_commission_rate != null && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-500/10 p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold uppercase tracking-widest text-amber-700">{t.approval_modal_custom_rate}</span>
                    <span className="text-xl font-bold text-amber-700">{details.custom_commission_rate}%</span>
                  </div>
                  <div className="flex justify-between text-sm text-stone-700 dark:text-neutral-200">
                    <span>{t.approval_modal_standard_amount}</span>
                    <span>{standardCommission.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-amber-800">
                    <span>{t.approval_modal_custom_amount}</span>
                    <span>
                      {customCommission.toFixed(2)} €{' '}
                      <span className="font-normal">({diff >= 0 ? '+' : ''}{diff.toFixed(2)} €)</span>
                    </span>
                  </div>
                </div>
              )}

              {details.installments_schedule && details.installments_schedule.length > 0 && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-500/10 p-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-blue-700 mb-2">{t.approval_modal_schedule_title}</h4>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {details.installments_schedule.map((entry) => (
                      <div key={entry.month} className="flex justify-between text-sm">
                        <span className="text-stone-700 dark:text-neutral-200">{t.schedule_custom_month} {entry.month}</span>
                        <span className="font-semibold text-stone-900 dark:text-white">{entry.amount.toFixed(2)} €</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {showRejectInput && !alreadyDecided && (
                <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-500/10 p-4">
                  <label className="block text-xs font-bold uppercase tracking-widest text-red-700 mb-2">{t.approval_modal_rejection_reason}</label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder={t.approval_modal_rejection_placeholder}
                    rows={3}
                    className="w-full rounded-lg border border-red-200 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-stone-900 dark:text-white focus:border-red-500 focus:outline-none resize-none"
                  />
                </div>
              )}
            </>
          )}
        </div>

        {!alreadyDecided && !loading && details && (
          <div className="flex items-center justify-end gap-2 border-t border-stone-200 dark:border-white/10 px-6 py-4">
            <button
              onClick={() => handleDecide('rejected')}
              disabled={submitting !== null || (showRejectInput && !rejectionReason.trim())}
              className="inline-flex items-center gap-2 rounded-full border-2 border-red-500 px-5 py-2 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {submitting === 'reject' ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              {submitting === 'reject' ? t.approval_modal_rejecting : t.approval_modal_reject}
            </button>
            <button
              onClick={() => handleDecide('approved')}
              disabled={submitting !== null}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-700 px-5 py-2 text-sm font-bold text-white shadow-md shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {submitting === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {submitting === 'approve' ? t.approval_modal_approving : t.approval_modal_approve}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoCard({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={cn(
      'rounded-xl border p-3',
      highlight
        ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-500/10'
        : 'border-stone-200 bg-stone-50/50 dark:border-white/10 dark:bg-white/5'
    )}>
      <div className="text-[10px] font-bold uppercase tracking-widest text-stone-500 dark:text-neutral-400 mb-1">{label}</div>
      <div className={cn('text-sm font-bold', highlight ? 'text-emerald-700' : 'text-stone-900 dark:text-white')}>{value}</div>
      {sub && <div className="text-xs text-stone-500 dark:text-neutral-400 mt-0.5">{sub}</div>}
    </div>
  )
}
