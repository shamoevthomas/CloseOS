import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  if (req.method === 'POST') {
    // Create invitation
    const { inviter_id, role } = req.body

    if (!inviter_id || !role) {
      return res.status(400).json({ error: 'inviter_id and role are required' })
    }

    const token = crypto.randomBytes(32).toString('hex')

    const { data, error } = await supabase
      .from('business_invitations')
      .insert({
        inviter_id,
        token,
        role,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single()

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ token: data.token, invitation: data })
  }

  if (req.method === 'GET') {
    // Validate token
    const { token } = req.query

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'token is required' })
    }

    const { data, error } = await supabase
      .from('business_invitations')
      .select('*, inviter:business_users!inviter_id(full_name, email)')
      .eq('token', token)
      .single()

    if (error || !data) {
      return res.status(404).json({ error: 'Invitation not found' })
    }

    if (data.used) {
      return res.status(400).json({ error: 'Invitation already used' })
    }

    if (new Date(data.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Invitation expired' })
    }

    return res.status(200).json({ invitation: data })
  }

  if (req.method === 'PUT') {
    // Accept invitation (mark as used + create team member)
    const { token, user_id, first_name, last_name, email } = req.body

    if (!token || !user_id) {
      return res.status(400).json({ error: 'token and user_id are required' })
    }

    // Fetch the invitation
    const { data: invitation, error: fetchError } = await supabase
      .from('business_invitations')
      .select('*')
      .eq('token', token)
      .single()

    if (fetchError || !invitation) {
      return res.status(404).json({ error: 'Invitation not found' })
    }

    if (invitation.used) {
      return res.status(400).json({ error: 'Invitation already used' })
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Invitation expired' })
    }

    // Mark invitation as used
    await supabase
      .from('business_invitations')
      .update({ used: true, used_by: user_id })
      .eq('id', invitation.id)

    // Create team member
    const { data: member, error: memberError } = await supabase
      .from('business_team_members')
      .insert({
        business_owner_id: invitation.inviter_id,
        user_id,
        role: invitation.role,
        first_name: first_name || '',
        last_name: last_name || '',
        email: email || '',
      })
      .select()
      .single()

    if (memberError) {
      return res.status(500).json({ error: memberError.message })
    }

    return res.status(200).json({ member })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
