import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const ADMIN_PASSWORD = '290917';

function checkAuth(req: VercelRequest): boolean {
  const pw = req.headers['x-admin-password'] as string || req.query.password as string;
  return pw === ADMIN_PASSWORD;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.query.action as string;

  // track-view is public (no auth required)
  if (action === 'track-view') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { slug } = req.body;
    if (!slug) return res.status(400).json({ error: 'slug required' });

    try { await supabase.rpc('increment_referral_views', { link_slug: slug }) } catch { /* ignore */ }
    // Fallback: direct update if RPC doesn't exist
    await supabase
      .from('business_referral_links')
      .update({ views: supabase.rpc ? undefined : 0 }) // handled by RPC
      .eq('slug', slug);

    // Simple increment
    const { data: link } = await supabase
      .from('business_referral_links')
      .select('id, views')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();

    if (link) {
      await supabase
        .from('business_referral_links')
        .update({ views: (link.views || 0) + 1 })
        .eq('id', link.id);
    }

    return res.json({ ok: true });
  }

  // All other actions require auth
  if (!checkAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // ─── LIST ───
  if (action === 'list') {
    const { data: links } = await supabase
      .from('business_referral_links')
      .select('*')
      .order('created_at', { ascending: false });

    if (!links) return res.json({ links: [] });

    // Get all conversions grouped by link
    const { data: conversions } = await supabase
      .from('business_referral_conversions')
      .select('*');

    const enriched = links.map(link => {
      const linkConversions = (conversions || []).filter(c => c.referral_link_id === link.id);
      const activeConversions = linkConversions.filter(c => c.status === 'active');
      const totalPaid = linkConversions.reduce((sum, c) => sum + Number(c.total_paid || 0), 0);

      // Calculate MRR commission for active users
      let commissionMrr = 0;
      for (const conv of activeConversions) {
        const { fixed, percent } = resolveCommission(link.commission_config, conv.subscription_plan, conv.billing_cycle);

        // Estimate monthly revenue from total_paid and billing cycle
        let monthlyRevenue = 0;
        if (conv.total_paid > 0 && conv.last_payment_at) {
          monthlyRevenue = Number(conv.total_paid) / Math.max(1, monthsSince(conv.created_at)) || 0;
        }

        commissionMrr += fixed + (monthlyRevenue * percent / 100);
      }

      return {
        ...link,
        stats: {
          total_conversions: linkConversions.length,
          active_conversions: activeConversions.length,
          churned_conversions: linkConversions.filter(c => c.status === 'churned').length,
          trial_conversions: linkConversions.filter(c => c.status === 'trial').length,
          total_paid: totalPaid,
          commission_mrr: Math.round(commissionMrr * 100) / 100,
        }
      };
    });

    return res.json({ links: enriched });
  }

  // ─── DETAIL ───
  if (action === 'detail') {
    const linkId = req.query.link_id as string;
    const planFilter = req.query.plan_filter as string;
    if (!linkId) return res.status(400).json({ error: 'link_id required' });

    const { data: link } = await supabase
      .from('business_referral_links')
      .select('*')
      .eq('id', linkId)
      .single();

    if (!link) return res.status(404).json({ error: 'Link not found' });

    let query = supabase
      .from('business_referral_conversions')
      .select('*')
      .eq('referral_link_id', linkId)
      .order('created_at', { ascending: false });

    if (planFilter && planFilter !== 'all') {
      query = query.eq('subscription_plan', planFilter);
    }

    const { data: conversions } = await query;

    // Enrich each conversion with commission info
    const enrichedConversions = (conversions || []).map(conv => {
      const { fixed, percent } = resolveCommission(link.commission_config, conv.subscription_plan, conv.billing_cycle);
      const months = Math.max(1, monthsSince(conv.created_at));
      const monthlyRevenue = Number(conv.total_paid) / months;
      const monthlyCommission = conv.status === 'active' ? fixed + (monthlyRevenue * percent / 100) : 0;
      const totalCommission = conv.status !== 'trial' ? (fixed * months) + (Number(conv.total_paid) * percent / 100) : 0;

      return {
        ...conv,
        monthly_commission: Math.round(monthlyCommission * 100) / 100,
        total_commission: Math.round(totalCommission * 100) / 100,
      };
    });

    return res.json({ link, conversions: enrichedConversions });
  }

  // ─── CREATE ───
  if (action === 'create') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { partner_name, slug, commission_config } = req.body;
    if (!partner_name || !slug) return res.status(400).json({ error: 'partner_name and slug required' });

    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
    const { data, error } = await supabase
      .from('business_referral_links')
      .insert({ partner_name, slug: cleanSlug, commission_config: commission_config || {} })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ link: data });
  }

  // ─── UPDATE ───
  if (action === 'update') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { link_id, commission_config, is_active, partner_name } = req.body;
    if (!link_id) return res.status(400).json({ error: 'link_id required' });

    const updates: any = {};
    if (commission_config !== undefined) updates.commission_config = commission_config;
    if (is_active !== undefined) updates.is_active = is_active;
    if (partner_name !== undefined) updates.partner_name = partner_name;

    const { data, error } = await supabase
      .from('business_referral_links')
      .update(updates)
      .eq('id', link_id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ link: data });
  }

  // ─── DELETE ───
  if (action === 'delete') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { link_id } = req.body;
    if (!link_id) return res.status(400).json({ error: 'link_id required' });

    await supabase.from('business_referral_conversions').delete().eq('referral_link_id', link_id);
    await supabase.from('business_referral_links').delete().eq('id', link_id);
    return res.json({ ok: true });
  }

  return res.status(400).json({ error: 'Unknown action' });
}

// Resolve commission rates: use per_billing config if available, otherwise fall back to default
function resolveCommission(commissionConfig: any, plan: string, billingCycle: string): { fixed: number; percent: number } {
  const planConfig = commissionConfig?.[plan] || {};
  // Check for per-billing-cycle config first
  if (planConfig.per_billing && planConfig.per_billing[billingCycle]) {
    const bc = planConfig.per_billing[billingCycle];
    return { fixed: Number(bc.fixed || 0), percent: Number(bc.percent || 0) };
  }
  // Fall back to default plan-level config
  return { fixed: Number(planConfig.fixed || 0), percent: Number(planConfig.percent || 0) };
}

function monthsSince(dateStr: string): number {
  const created = new Date(dateStr);
  const now = new Date();
  const months = (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth());
  return Math.max(1, months || 1);
}
