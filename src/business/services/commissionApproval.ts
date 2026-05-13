import { supabase } from '../../lib/supabase'

export interface CommissionApprovalPayload {
  business_owner_id: string
  prospect_id: number
  closer_id: string
  reason: 'commission' | 'schedule' | 'both'
  sale_amount: number
  standard_commission_rate: number
  custom_commission_rate: number | null
  installments_schedule: { month: number; amount: number }[] | null
}

export interface CommissionApprovalRecord extends CommissionApprovalPayload {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  approved_by: string | null
  rejection_reason: string | null
  decided_at: string | null
  created_at: string
}

interface NotifyContext {
  closerName: string
  prospectName: string
  offerName?: string
}

const APPROVAL_NOTIFICATION_TYPE = 'booking' // Réutilise type existant pour compatibilité NotificationsContext

export async function createCommissionApproval(
  payload: CommissionApprovalPayload,
  ctx: NotifyContext
): Promise<CommissionApprovalRecord | null> {
  const { data: approval, error } = await supabase
    .from('commission_approvals')
    .insert(payload)
    .select()
    .single()

  if (error || !approval) {
    console.error('createCommissionApproval insert failed:', error)
    return null
  }

  await supabase
    .from('business_prospects')
    .update({
      commission_approval_status: 'pending',
      commission_approval_id: approval.id,
    })
    .eq('id', payload.prospect_id)

  await triggerApprovalNotifications(approval as CommissionApprovalRecord, ctx)
  return approval as CommissionApprovalRecord
}

async function triggerApprovalNotifications(
  approval: CommissionApprovalRecord,
  ctx: NotifyContext
) {
  const businessOwnerId = approval.business_owner_id

  // 1. Owner email
  const { data: ownerUser } = await supabase
    .from('business_users')
    .select('id, email, full_name')
    .eq('id', businessOwnerId)
    .maybeSingle()

  // 2. All HOS + Admin team members
  const { data: teamApprovers } = await supabase
    .from('business_team_members')
    .select('id, user_id, email, first_name, last_name, role')
    .eq('business_owner_id', businessOwnerId)
    .in('role', ['Head of Sales', 'Admin'])

  const targets: { user_id: string; email: string | null; name: string }[] = []

  if (ownerUser?.id) {
    targets.push({
      user_id: ownerUser.id,
      email: ownerUser.email || null,
      name: ownerUser.full_name || 'Owner',
    })
  }

  for (const tm of teamApprovers || []) {
    if (!tm.user_id) continue
    if (tm.user_id === ownerUser?.id) continue
    targets.push({
      user_id: tm.user_id,
      email: tm.email || null,
      name: `${tm.first_name || ''} ${tm.last_name || ''}`.trim() || tm.role || 'Approuveur',
    })
  }

  const titleFr = 'Commission inhabituelle à valider'
  const description = `${ctx.closerName} a enregistré une vente de ${approval.sale_amount.toFixed(2)} €${
    approval.custom_commission_rate != null ? ` avec une commission ${approval.custom_commission_rate}% (standard ${approval.standard_commission_rate}%)` : ''
  }${approval.installments_schedule ? ' avec un échéancier personnalisé' : ''}.`

  // 3. Insert notifications + send emails in parallel
  await Promise.all(
    targets.map(async (t) => {
      const notif = supabase.from('notifications').insert({
        user_id: t.user_id,
        title: titleFr,
        description,
        time: new Date().toISOString(),
        type: APPROVAL_NOTIFICATION_TYPE,
        read: false,
      })

      const emailPromise = t.email
        ? sendApprovalEmail({
            to: t.email,
            recipientName: t.name,
            closerName: ctx.closerName,
            prospectName: ctx.prospectName,
            offerName: ctx.offerName,
            saleAmount: approval.sale_amount,
            standardRate: approval.standard_commission_rate,
            customRate: approval.custom_commission_rate,
            hasCustomSchedule: !!approval.installments_schedule,
            approvalId: approval.id,
          })
        : Promise.resolve()

      await Promise.all([notif, emailPromise])
    })
  )
}

async function sendApprovalEmail(params: {
  to: string
  recipientName: string
  closerName: string
  prospectName: string
  offerName?: string
  saleAmount: number
  standardRate: number
  customRate: number | null
  hasCustomSchedule: boolean
  approvalId: string
}) {
  const standardCommission = (params.saleAmount * params.standardRate) / 100
  const customCommission =
    params.customRate != null ? (params.saleAmount * params.customRate) / 100 : standardCommission
  const diff = customCommission - standardCommission
  const diffStr = `${diff >= 0 ? '+' : ''}${diff.toFixed(2)} €`
  const approveLink = `https://closeos.fr/business/crm?approve=${params.approvalId}`

  const exceptionLines: string[] = []
  if (params.customRate != null) {
    exceptionLines.push(
      `<li style="color:#cbd5e2;">Taux demandé : <strong style="color:#fbbf24;">${params.customRate}%</strong> (standard : ${params.standardRate}%)</li>`,
      `<li style="color:#cbd5e2;">Commission : <strong style="color:#fbbf24;">${customCommission.toFixed(2)} €</strong> au lieu de ${standardCommission.toFixed(2)} € — écart ${diffStr}</li>`
    )
  }
  if (params.hasCustomSchedule) {
    exceptionLines.push(`<li style="color:#cbd5e2;">Échéancier de paiement personnalisé proposé par le closer</li>`)
  }

  const htmlContent = `<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:0;background-color:#020617;font-family:'Segoe UI',Arial,sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#020617;">
    <tr><td align="center" style="padding:40px 20px;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;">
        <tr><td align="center" style="padding-bottom:20px;">
          <img src="https://closeos.fr/logo.PNG" alt="CloseOS" width="140" style="display:block;">
        </td></tr>
        <tr><td style="padding:0 20px;">
          <span style="background-color:#7c2d12;border:1px solid #f59e0b;color:#f59e0b;padding:4px 12px;border-radius:50px;font-size:12px;font-weight:bold;text-transform:uppercase;">Validation requise</span>
          <h1 style="color:#fdfdfd;font-size:24px;margin:20px 0 16px 0;">Commission inhabituelle à valider</h1>
          <p style="color:#94a3b9;font-size:15px;line-height:1.6;">
            Bonjour ${params.recipientName},<br><br>
            <strong style="color:#fdfdfd;">${params.closerName}</strong> a enregistré une vente nécessitant votre approbation.
          </p>
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0f172a;border:1px solid #f59e0b;border-radius:16px;margin:20px 0;">
            <tr><td style="padding:24px;">
              <h3 style="color:#fbbf24;font-size:16px;margin:0 0 12px 0;">Détails de la vente</h3>
              <ul style="margin:0;padding-left:18px;line-height:1.8;font-size:14px;">
                <li style="color:#cbd5e2;">Prospect : <strong style="color:#fdfdfd;">${params.prospectName}</strong></li>
                ${params.offerName ? `<li style="color:#cbd5e2;">Offre : <strong style="color:#fdfdfd;">${params.offerName}</strong></li>` : ''}
                <li style="color:#cbd5e2;">Montant : <strong style="color:#fdfdfd;">${params.saleAmount.toFixed(2)} €</strong></li>
                ${exceptionLines.join('\n')}
              </ul>
            </td></tr>
          </table>
          <p style="text-align:center;margin:30px 0;">
            <a href="${approveLink}" style="background-color:#10b981;color:#fdfdfd;text-decoration:none;padding:16px 32px;border-radius:12px;font-weight:bold;display:inline-block;font-size:16px;">Examiner et valider</a>
          </p>
          <p style="color:#64748b;font-size:13px;line-height:1.6;margin-top:30px;">
            La facture de cette vente sera bloquée tant que vous n'aurez pas validé ou rejeté cette commission.
          </p>
        </td></tr>
        <tr><td align="center" style="padding:30px 20px 0;">
          <p style="color:#475569;font-size:11px;">&copy; 2026 CloseOS Business &mdash; support@closeos.fr</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  try {
    await fetch('/api/email?action=send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { email: 'support@closeos.fr', name: 'CloseOS Business' },
        to: [{ email: params.to, name: params.recipientName }],
        subject: 'Commission inhabituelle à valider',
        htmlContent,
      }),
    })
  } catch (err) {
    console.error('sendApprovalEmail failed:', err)
  }
}

export async function decideCommissionApproval(
  approvalId: string,
  prospectId: number,
  decision: 'approved' | 'rejected',
  approverId: string,
  rejectionReason?: string,
  context?: { closerUserId?: string; closerName?: string; prospectName?: string }
) {
  const { error } = await supabase
    .from('commission_approvals')
    .update({
      status: decision,
      approved_by: approverId,
      rejection_reason: decision === 'rejected' ? rejectionReason || null : null,
      decided_at: new Date().toISOString(),
    })
    .eq('id', approvalId)

  if (error) {
    console.error('decideCommissionApproval failed:', error)
    return false
  }

  const prospectUpdate: any = { commission_approval_status: decision }
  if (decision === 'rejected') {
    prospectUpdate.custom_commission_rate = null
    prospectUpdate.installments_schedule = null
  }
  await supabase.from('business_prospects').update(prospectUpdate).eq('id', prospectId)

  // Notify closer
  if (context?.closerUserId) {
    const title =
      decision === 'approved'
        ? 'Commission inhabituelle validée'
        : 'Commission inhabituelle rejetée'
    const description =
      decision === 'approved'
        ? `Votre commission custom pour ${context.prospectName || 'le prospect'} a été approuvée.`
        : `Votre commission custom pour ${context.prospectName || 'le prospect'} a été rejetée${
            rejectionReason ? ` — raison : ${rejectionReason}` : ''
          }. Le taux standard a été restauré.`

    await supabase.from('notifications').insert({
      user_id: context.closerUserId,
      title,
      description,
      time: new Date().toISOString(),
      type: APPROVAL_NOTIFICATION_TYPE,
      read: false,
    })
  }

  return true
}
