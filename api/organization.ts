import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-01-27.acacia' as any })

const EXTRA_ORG_PRICE_ID = 'price_1TJwng33xpuYLywqwO0J1k9R'

// ─── Shared join logic (used by free join + webhook after payment) ───
async function executeJoin(supabase: any, token: string, user_id: string) {
  const { data: invitation, error: fetchError } = await supabase
    .from('business_invitations')
    .select('*')
    .eq('token', token)
    .single()

  if (fetchError || !invitation) throw new Error('Invitation introuvable.')
  if (invitation.used) throw new Error('Ce lien d\'invitation a déjà été utilisé.')
  if (new Date(invitation.expires_at) < new Date()) throw new Error('Ce lien d\'invitation a expiré.')

  await supabase
    .from('business_invitations')
    .update({ used: true, used_by: user_id })
    .eq('id', invitation.id)

  const { data: userProfile } = await supabase
    .from('profiles')
    .select('full_name, phone, role, avatar_url')
    .eq('id', user_id)
    .single()

  const firstName = userProfile?.full_name?.split(' ')[0] || ''
  const lastName = userProfile?.full_name?.split(' ').slice(1).join(' ') || ''

  const { data: authUser } = await supabase.auth.admin.getUserById(user_id)
  const email = authUser?.user?.email || ''

  const { data: existing } = await supabase
    .from('business_team_members')
    .select('id')
    .eq('user_id', user_id)
    .eq('business_owner_id', invitation.inviter_id)
    .single()

  let memberId: string

  if (existing) {
    const { error: updateErr } = await supabase
      .from('business_team_members')
      .update({
        role: invitation.role,
        can_manage_campaigns: !!invitation.can_manage_campaigns,
        setter_scope: invitation.setter_scope || null,
        custom_permissions: invitation.custom_permissions || null,
        first_name: firstName,
        last_name: lastName,
        email,
        avatar_url: userProfile?.avatar_url || null,
        has_onboarded: true,
        onboarding_acknowledged: true,
      })
      .eq('id', existing.id)
    if (updateErr) throw new Error(updateErr.message)
    memberId = existing.id
  } else {
    const { data: member, error: memberError } = await supabase
      .from('business_team_members')
      .insert({
        business_owner_id: invitation.inviter_id,
        user_id,
        role: invitation.role,
        can_manage_campaigns: !!invitation.can_manage_campaigns,
        setter_scope: invitation.setter_scope || null,
        custom_permissions: invitation.custom_permissions || null,
        first_name: firstName,
        last_name: lastName,
        email,
        avatar_url: userProfile?.avatar_url || null,
        has_onboarded: true,
        onboarding_acknowledged: true,
      })
      .select('id')
      .single()
    if (memberError) throw new Error(memberError.message)
    memberId = member.id
  }

  await supabase
    .from('profiles')
    .update({
      business_member_id: memberId,
      business_owner_id: invitation.inviter_id,
    })
    .eq('id', user_id)

  return { memberId, invitation }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const action = req.query.action as string

  try {
    // ─── JOIN ORGANIZATION (free for first org) ───
    if (action === 'join' && req.method === 'POST') {
      const { token, user_id } = req.body
      if (!token || !user_id) {
        return res.status(400).json({ error: 'token and user_id are required' })
      }

      // Check if user is already in an organization → payment required
      const { data: profile } = await supabase
        .from('profiles')
        .select('business_member_id')
        .eq('id', user_id)
        .single()

      if (profile?.business_member_id) {
        return res.status(402).json({ payment_required: true, error: 'Paiement requis pour rejoindre une organisation supplémentaire (10€).' })
      }

      const { memberId, invitation } = await executeJoin(supabase, token, user_id)

      // Fetch org info to return
      const { data: ownerSettings } = await supabase
        .from('business_settings')
        .select('company_name, logo_url')
        .eq('user_id', invitation.inviter_id)
        .single()

      const { data: ownerUser } = await supabase
        .from('business_users')
        .select('full_name')
        .eq('id', invitation.inviter_id)
        .single()

      return res.status(200).json({
        success: true,
        organization: {
          member_id: memberId,
          owner_id: invitation.inviter_id,
          role: invitation.role,
          org_name: ownerSettings?.company_name || ownerUser?.full_name || 'Organisation',
          logo_url: ownerSettings?.logo_url || null,
          owner_name: ownerUser?.full_name || '',
        }
      })
    }

    // ─── ORG CHECKOUT (Stripe redirect for extra org) ───
    if (action === 'org-checkout' && req.method === 'POST') {
      const { token, user_id } = req.body
      if (!token || !user_id) {
        return res.status(400).json({ error: 'token and user_id are required' })
      }

      // Validate invitation (don't mark as used yet — webhook will do that)
      const { data: invitation, error: fetchError } = await supabase
        .from('business_invitations')
        .select('*')
        .eq('token', token)
        .single()

      if (fetchError || !invitation) return res.status(404).json({ error: 'Invitation introuvable.' })
      if (invitation.used) return res.status(400).json({ error: 'Ce lien d\'invitation a déjà été utilisé.' })
      if (new Date(invitation.expires_at) < new Date()) return res.status(400).json({ error: 'Ce lien d\'invitation a expiré.' })

      // Get user email for pre-fill
      const { data: authUser } = await supabase.auth.admin.getUserById(user_id)
      const customerEmail = authUser?.user?.email || ''

      const origin = req.headers.origin || 'https://closeos.fr'
      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: EXTRA_ORG_PRICE_ID, quantity: 1 }],
        mode: 'payment',
        customer_email: customerEmail,
        success_url: `${origin}/settings?org_joined=true`,
        cancel_url: `${origin}/settings`,
        metadata: { token, user_id, action: 'join-extra-org' },
      })

      return res.status(200).json({ url: session.url })
    }

    // ─── LEAVE ORGANIZATION ───
    if (action === 'leave' && req.method === 'POST') {
      const { user_id } = req.body
      if (!user_id) return res.status(400).json({ error: 'user_id is required' })

      // Get current member info
      const { data: profile } = await supabase
        .from('profiles')
        .select('business_member_id, business_owner_id')
        .eq('id', user_id)
        .single()

      if (!profile?.business_member_id) {
        return res.status(400).json({ error: 'Vous n\'appartenez à aucune organisation.' })
      }

      // Clear profiles link first (FK references team_member)
      await supabase
        .from('profiles')
        .update({ business_member_id: null, business_owner_id: null })
        .eq('id', user_id)

      // Delete the team member row entirely
      const { error } = await supabase
        .from('business_team_members')
        .delete()
        .eq('id', profile.business_member_id)

      if (error) return res.status(500).json({ error: error.message })

      return res.status(200).json({ success: true })
    }

    // ─── GET ORGANIZATION ───
    if (action === 'get' && req.method === 'POST') {
      const { user_id } = req.body
      if (!user_id) return res.status(400).json({ error: 'user_id is required' })

      const { data: profile } = await supabase
        .from('profiles')
        .select('business_member_id, business_owner_id')
        .eq('id', user_id)
        .single()

      if (!profile?.business_member_id) {
        return res.status(200).json({ organization: null })
      }

      // Verify the team member still exists (owner may have deleted it)
      const { data: member } = await supabase
        .from('business_team_members')
        .select('id, role, joined_at, can_manage_campaigns, setter_scope, custom_permissions')
        .eq('id', profile.business_member_id)
        .single()

      if (!member) {
        // Stale link — clean up
        await supabase
          .from('profiles')
          .update({ business_member_id: null, business_owner_id: null })
          .eq('id', user_id)
        return res.status(200).json({ organization: null })
      }

      // Fetch org info
      const [settingsRes, ownerRes] = await Promise.all([
        supabase
          .from('business_settings')
          .select('company_name, logo_url')
          .eq('user_id', profile.business_owner_id)
          .single(),
        supabase
          .from('business_users')
          .select('full_name')
          .eq('id', profile.business_owner_id)
          .single(),
      ])

      return res.status(200).json({
        organization: {
          member_id: member.id,
          owner_id: profile.business_owner_id,
          role: member.role,
          joined_at: member.joined_at,
          can_manage_campaigns: member.can_manage_campaigns,
          setter_scope: member.setter_scope,
          custom_permissions: member.custom_permissions,
          org_name: settingsRes.data?.company_name || ownerRes.data?.full_name || 'Organisation',
          logo_url: settingsRes.data?.logo_url || null,
          owner_name: ownerRes.data?.full_name || '',
        }
      })
    }

    // ─── LIST ALL ORGANIZATIONS for a user ───
    if (action === 'list' && req.method === 'POST') {
      const { user_id } = req.body
      if (!user_id) return res.status(400).json({ error: 'user_id is required' })

      // Get all team memberships for this user
      const { data: memberships } = await supabase
        .from('business_team_members')
        .select('id, business_owner_id, role, joined_at')
        .eq('user_id', user_id)

      if (!memberships || memberships.length === 0) {
        return res.status(200).json({ organizations: [] })
      }

      // Get active org from profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('business_member_id')
        .eq('id', user_id)
        .single()

      // Fetch org info for each membership
      const orgs = await Promise.all(memberships.map(async (m) => {
        const [settingsRes, ownerRes] = await Promise.all([
          supabase.from('business_settings').select('company_name, logo_url').eq('user_id', m.business_owner_id).single(),
          supabase.from('business_users').select('full_name').eq('id', m.business_owner_id).single(),
        ])
        return {
          member_id: m.id,
          owner_id: m.business_owner_id,
          role: m.role,
          joined_at: m.joined_at,
          org_name: settingsRes.data?.company_name || ownerRes.data?.full_name || 'Organisation',
          logo_url: settingsRes.data?.logo_url || null,
          owner_name: ownerRes.data?.full_name || '',
          is_active: m.id === profile?.business_member_id,
        }
      }))

      return res.status(200).json({ organizations: orgs })
    }

    // ─── SWITCH ACTIVE ORGANIZATION ───
    if (action === 'switch' && req.method === 'POST') {
      const { user_id, member_id } = req.body
      if (!user_id || !member_id) return res.status(400).json({ error: 'user_id and member_id are required' })

      // Verify the membership belongs to this user
      const { data: member } = await supabase
        .from('business_team_members')
        .select('id, business_owner_id')
        .eq('id', member_id)
        .eq('user_id', user_id)
        .single()

      if (!member) return res.status(404).json({ error: 'Membership not found' })

      await supabase
        .from('profiles')
        .update({ business_member_id: member.id, business_owner_id: member.business_owner_id })
        .eq('id', user_id)

      return res.status(200).json({ success: true })
    }

    return res.status(400).json({ error: 'Unknown action' })
  } catch (err: any) {
    console.error('Organization API error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
