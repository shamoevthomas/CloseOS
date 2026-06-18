import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

/**
 * CloseOS Sign — relances automatiques des contrats envoyés non signés (cron quotidien).
 *
 * Cadence (jours depuis l'envoi) :
 *   - sem. 1   (j1-7)   : tous les 2 jours
 *   - sem. 2   (j8-14)  : tous les 3 jours
 *   - sem. 3-4 (j15-30) : ~2×/semaine (tous les 4 jours)
 *   - mois 2   (j31-60) : 1×/semaine
 *   - mois 3   (j61-90) : 1×/2 semaines  → emails d'AVERTISSEMENT de suppression
 *   - j ≥ 90            : suppression définitive du contrat
 *
 * Ne relance que les contrats `status='sent'`, avec un lien (access_token) et un email signataire.
 *
 * Ancrage : la cadence ET le compteur de suppression partent de `reminder_started_at`
 * (sinon `sent_at`). Les contrats déjà en attente au lancement ont été ancrés à la date
 * de mise en service → reprise progressive, sans envoi groupé ni suppression immédiate.
 */

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const brevoApiKey = process.env.BREVO_API_KEY || '';
const cronSecret = process.env.CRON_SECRET;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SIGN_ORIGIN = 'https://sign.closeos.fr';
const DAY = 86_400_000;

const DELETE_AFTER_DAYS = 90;

/** Intervalle de relance (en jours) selon l'ancienneté, ou 'delete'. */
function intervalForAge(daysSinceSent: number): number | 'delete' {
  if (daysSinceSent >= DELETE_AFTER_DAYS) return 'delete';
  if (daysSinceSent < 7) return 2;   // semaine 1
  if (daysSinceSent < 14) return 3;  // semaine 2
  if (daysSinceSent < 30) return 4;  // semaines 3-4 (~2×/sem)
  if (daysSinceSent < 60) return 7;  // mois 2
  return 14;                          // mois 3 (jusqu'à j90)
}

function frDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

async function sendEmail(to: string, subject: string, htmlContent: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { accept: 'application/json', 'api-key': brevoApiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: { email: 'support@closeos.fr', name: 'CloseOS Sign' },
        to: [{ email: to }],
        subject,
        htmlContent,
      }),
    });
    return res.ok;
  } catch (e) {
    console.error('[sign-reminders] email error', e);
    return false;
  }
}

function reminderHtml(opts: { name: string; title: string; link: string; deleteDate?: string }): string {
  const warning = !!opts.deleteDate;
  const heading = warning ? 'Dernier rappel — ce document va être supprimé' : 'Petit rappel : un document vous attend';
  const intro = warning
    ? `Sans signature de votre part, le document <strong style="color:#F3F4F6;">${opts.title}</strong> sera <strong style="color:#ef6b6b;">définitivement supprimé le ${opts.deleteDate}</strong>.`
    : `Vous n'avez pas encore signé le document : <strong style="color:#F3F4F6;">${opts.title}</strong>.`;
  return `
  <div style="background:#191E1E;padding:32px 0;font-family:Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#222828;border:1px solid ${warning ? '#ef6b6b' : '#3A4242'};border-radius:12px;overflow:hidden;">
        <tr><td style="padding:28px 32px 8px;">
          <img src="https://sign.closeos.fr/CLOSEOS-SIGN-LOGO.png" alt="CloseOS Sign" height="30" style="height:30px;width:auto;display:block;" />
        </td></tr>
        <tr><td style="padding:8px 32px 0;">
          <h1 style="color:#ffffff;font-size:22px;margin:12px 0 8px;">${heading}</h1>
          <p style="color:#A1A9A9;font-size:14px;line-height:1.6;margin:0 0 4px;">
            Bonjour ${opts.name || ''},<br/>
            ${intro}
          </p>
        </td></tr>
        <tr><td style="padding:24px 32px;">
          <a href="${opts.link}" style="display:inline-block;background:#CEFF8F;color:#191E1E;font-weight:700;font-size:15px;text-decoration:none;padding:14px 28px;border-radius:8px;">
            Consulter &amp; signer
          </a>
        </td></tr>
        <tr><td style="padding:0 32px 28px;">
          <p style="color:#6b7280;font-size:11px;line-height:1.6;margin:0;">
            Ou copiez ce lien : <a href="${opts.link}" style="color:#CEFF8F;">${opts.link}</a><br/>
            Signature sécurisée — conformité RGPD.
          </p>
        </td></tr>
      </table>
    </td></tr></table>
  </div>`;
}

export default async function handler(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response('server_misconfigured', { status: 500 });
  }

  const now = Date.now();
  const out = { scanned: 0, reminded: 0, warned: 0, deleted: 0, skipped: 0, errors: 0 };

  // Contrats envoyés, non signés, avec lien.
  const { data: contracts, error } = await supabaseAdmin
    .from('sign_contracts')
    .select('id,title,status,access_token,sent_at,reminder_started_at,last_reminder_at,contact_id,verification_email')
    .eq('status', 'sent')
    .not('access_token', 'is', null)
    .not('sent_at', 'is', null);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'content-type': 'application/json' } });

  // Map des contacts (un seul fetch).
  const contactIds = [...new Set((contracts ?? []).map((c: any) => c.contact_id).filter(Boolean))];
  const contactMap: Record<string, { name: string; email: string }> = {};
  if (contactIds.length) {
    const { data: cts } = await supabaseAdmin.from('sign_contacts').select('id,name,email').in('id', contactIds);
    for (const ct of cts ?? []) contactMap[(ct as any).id] = { name: (ct as any).name || '', email: ((ct as any).email || '').trim() };
  }

  for (const c of contracts ?? []) {
    out.scanned++;
    try {
      // Ancrage du programme : reminder_started_at sinon sent_at.
      const anchor = new Date((c as any).reminder_started_at || (c as any).sent_at).getTime();
      const daysSinceAnchor = Math.floor((now - anchor) / DAY);

      const iv = intervalForAge(daysSinceAnchor);
      if (iv === 'delete') {
        await supabaseAdmin.from('sign_contracts').delete().eq('id', (c as any).id);
        out.deleted++;
        continue;
      }

      const baseline = (c as any).last_reminder_at ? new Date((c as any).last_reminder_at).getTime() : anchor;
      const daysSinceBaseline = Math.floor((now - baseline) / DAY);
      if (daysSinceBaseline < iv) { out.skipped++; continue; }

      // Résolution destinataire + lien.
      let email = (((c as any).verification_email as string) || '').trim();
      let name = '';
      let token = ((c as any).access_token as string) || null;
      const contactId = (c as any).contact_id as string | null;
      if (!email && contactId && contactMap[contactId]) {
        email = contactMap[contactId].email;
        name = contactMap[contactId].name;
      }
      if (!email || !token) {
        const { data: s } = await supabaseAdmin
          .from('sign_contract_signers')
          .select('name,email,access_token')
          .eq('contract_id', (c as any).id)
          .order('signer_index', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (s) {
          email = email || (((s as any).email as string) || '').trim();
          name = name || (((s as any).name as string) || '').trim();
          token = token || (((s as any).access_token as string) || null);
        }
      }
      if (!email || !token) { out.skipped++; continue; }

      const link = `${SIGN_ORIGIN}/sign/s/${token}`;
      // Avertissement de suppression dès le mois 3 (j60+ depuis l'ancrage).
      const deleteDate = daysSinceAnchor >= 60 ? frDate(new Date(anchor + DELETE_AFTER_DAYS * DAY)) : undefined;
      const subject = deleteDate
        ? `⚠️ Dernier rappel — ${(c as any).title || 'votre document'} (suppression imminente)`
        : `Rappel — à signer : ${(c as any).title || 'votre document'}`;

      const ok = await sendEmail(email, subject, reminderHtml({ name, title: (c as any).title || 'Votre contrat', link, deleteDate }));
      if (!ok) { out.errors++; continue; }

      await supabaseAdmin.from('sign_contracts').update({ last_reminder_at: new Date(now).toISOString() }).eq('id', (c as any).id);
      // Faisceau de preuves (best-effort).
      try {
        await supabaseAdmin.from('sign_signature_events').insert({ contract_id: (c as any).id, contact_id: contactId, event_type: 'reminder', email });
      } catch { /* non bloquant */ }

      if (deleteDate) out.warned++; else out.reminded++;
    } catch (e) {
      console.error('[sign-reminders] contract error', (c as any)?.id, e);
      out.errors++;
    }
  }

  return new Response(JSON.stringify(out), { status: 200, headers: { 'content-type': 'application/json' } });
}
