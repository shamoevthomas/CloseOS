import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const action = req.query.action as string

  try {
    // ─── JOIN ORGANIZATION ───
    if (action === 'join' && req.method === 'POST') {
      const { token, user_id } = req.body
      if (!token || !user_id) {
        return res.status(400).json({ error: 'token and user_id are required' })
      }

      // Check if user is already in an organization
      const { data: profile } = await supabase
        .from('profiles')
        .select('business_member_id')
        .eq('id', user_id)
        .single()

      if (profile?.business_member_id) {
        return res.status(400).json({ error: 'Vous devez quitter votre organisation actuelle avant d\'en rejoindre une autre.' })
      }

      // Validate the invitation token
      const { data: invitation, error: fetchError } = await supabase
        .from('business_invitations')
        .select('*')
        .eq('token', token)
        .single()

      if (fetchError || !invitation) return res.status(404).json({ error: 'Invitation introuvable.' })
      if (invitation.used) return res.status(400).json({ error: 'Ce lien d\'invitation a déjà été utilisé.' })
      if (new Date(invitation.expires_at) < new Date()) return res.status(400).json({ error: 'Ce lien d\'invitation a expiré.' })

      // Mark invitation as used
      await supabase
        .from('business_invitations')
        .update({ used: true, used_by: user_id })
        .eq('id', invitation.id)

      // Get user info from profiles
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('full_name, phone, role, avatar_url')
        .eq('id', user_id)
        .single()

      const firstName = userProfile?.full_name?.split(' ')[0] || ''
      const lastName = userProfile?.full_name?.split(' ').slice(1).join(' ') || ''

      // Get user email from auth
      const { data: authUser } = await supabase.auth.admin.getUserById(user_id)
      const email = authUser?.user?.email || ''

      // Check if user is already a team member for this owner
      const { data: existing } = await supabase
        .from('business_team_members')
        .select('id')
        .eq('user_id', user_id)
        .eq('business_owner_id', invitation.inviter_id)
        .single()

      let memberId: string

      if (existing) {
        // Update existing member
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
        if (updateErr) return res.status(500).json({ error: updateErr.message })
        memberId = existing.id
      } else {
        // Create new team member
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
        if (memberError) return res.status(500).json({ error: memberError.message })
        memberId = member.id
      }

      // Update profiles with business link
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          business_member_id: memberId,
          business_owner_id: invitation.inviter_id,
        })
        .eq('id', user_id)

      if (profileError) return res.status(500).json({ error: profileError.message })

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

    return res.status(400).json({ error: 'Unknown action' })
  } catch (err: any) {
    console.error('Organization API error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
