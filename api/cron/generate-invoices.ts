import { createClient } from '@supabase/supabase-js';

export const config = {
    runtime: 'edge',
};

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const brevoApiKey = process.env.BREVO_API_KEY!;
const cronSecret = process.env.CRON_SECRET;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

// --- HELPER: Envoi email via Brevo ---
async function sendEmailBrevo(payload: {
    sender: { name: string; email: string };
    replyTo?: { email: string; name: string };
    to: { email: string; name?: string }[];
    subject: string;
    htmlContent: string;
}) {
    try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'api-key': brevoApiKey,
                'content-type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const err = await response.text();
            console.error('Brevo error:', err);
        }
        return response.ok;
    } catch (error) {
        console.error('Email send error:', error);
        return false;
    }
}

// --- HELPER: Format currency ---
function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
}

// --- HELPER: Get payment method label from details ---
function getPaymentMethodHTML(method: any): string {
    if (!method) return '';

    const type = method.type;
    const details = method.details || {};

    if (type === 'VIREMENT') {
        return `
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-top: 10px;">
        <p style="margin: 0 0 5px; font-weight: bold; color: #334155;">💳 Virement Bancaire</p>
        ${details.accountHolder ? `<p style="margin: 2px 0; font-size: 13px; color: #475569;">Titulaire : ${details.accountHolder}</p>` : ''}
        ${details.iban ? `<p style="margin: 2px 0; font-size: 13px; color: #475569;">IBAN : ${details.iban}</p>` : ''}
        ${details.bic ? `<p style="margin: 2px 0; font-size: 13px; color: #475569;">BIC : ${details.bic}</p>` : ''}
      </div>
    `;
    }
    if (type === 'PAYPAL') {
        return `
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-top: 10px;">
        <p style="margin: 0 0 5px; font-weight: bold; color: #334155;">💳 PayPal</p>
        ${details.identifier ? `<p style="margin: 2px 0; font-size: 13px; color: #475569;">Email : ${details.identifier}</p>` : ''}
      </div>
    `;
    }
    if (type === 'REVOLUT') {
        return `
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-top: 10px;">
        <p style="margin: 0 0 5px; font-weight: bold; color: #334155;">💳 Revolut</p>
        ${details.identifier ? `<p style="margin: 2px 0; font-size: 13px; color: #475569;">Revtag : ${details.identifier}</p>` : ''}
      </div>
    `;
    }
    if (type === 'STRIPE') {
        return details.paymentLink
            ? `
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-top: 10px;">
        <p style="margin: 0 0 10px; font-weight: bold; color: #334155;">💳 Paiement en ligne</p>
        <a href="${details.paymentLink}" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Payer par Carte Bancaire</a>
      </div>
    `
            : '';
    }
    return '';
}

export default async function handler(req: Request) {
    // Auth check
    const authHeader = req.headers.get('authorization');
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const today = new Date();
        const dayOfMonth = today.getUTCDate();

        // 1. Get all enabled configs where day_of_month matches today
        const { data: configs, error: configError } = await supabaseAdmin
            .from('auto_invoice_configs')
            .select('*')
            .eq('enabled', true)
            .eq('day_of_month', dayOfMonth);

        if (configError) throw configError;
        if (!configs || configs.length === 0) {
            return new Response(JSON.stringify({ message: 'No invoices to generate today', day: dayOfMonth }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const results: any[] = [];

        for (const config of configs) {
            try {
                // 2. Get the offer
                const { data: offer, error: offerErr } = await supabaseAdmin
                    .from('offers')
                    .select('*')
                    .eq('id', config.offer_id)
                    .single();

                if (offerErr || !offer) {
                    results.push({ config_id: config.id, status: 'error', error: 'Offer not found' });
                    continue;
                }

                // Skip if offer is archived or no billing email
                if (offer.status !== 'active') {
                    results.push({ config_id: config.id, status: 'skipped', reason: 'Offer not active' });
                    continue;
                }

                // 3. Get issuer profile if configured
                let issuerProfile: any = null;
                if (config.issuer_profile_id) {
                    const { data } = await supabaseAdmin
                        .from('issuer_profiles')
                        .select('*')
                        .eq('id', config.issuer_profile_id)
                        .single();
                    issuerProfile = data;
                }

                // 4. Get payment method if configured
                let paymentMethod: any = null;
                if (config.payment_method_id) {
                    const { data } = await supabaseAdmin
                        .from('payment_methods')
                        .select('*')
                        .eq('id', config.payment_method_id)
                        .single();
                    paymentMethod = data;
                }

                // 5. Get user email (for copy)
                let userEmail: string | null = null;
                if (config.send_copy_to_user) {
                    const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(config.user_id);
                    userEmail = user?.email || null;
                }

                // 6. Calculate commission for the previous month
                const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0); // last day of prev month
                const prevMonthStart = new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 1);

                const { data: prospects } = await supabaseAdmin
                    .from('prospects')
                    .select('*')
                    .eq('user_id', config.user_id)
                    .eq('stage', 'won');

                // Filter prospects for this offer and period
                const offerDeals = (prospects || []).filter((p: any) => {
                    const isCorrectOffer =
                        p.offer_id === offer.id ||
                        String(p.offer_id) === String(offer.id) ||
                        p.offer === offer.name;
                    if (!isCorrectOffer) return false;

                    const dealDate = new Date(p.lastContact || p.dateAdded || p.created_at);
                    const isInstallment = p.payment_type === 'installments' || (p.installments && p.installments > 1);

                    if (!isInstallment) {
                        return dealDate >= prevMonthStart && dealDate <= prevMonthEnd;
                    }

                    // For installments, check if any installment falls in the period
                    const months = p.installments || 1;
                    const endDateDeal = new Date(dealDate);
                    endDateDeal.setMonth(endDateDeal.getMonth() + (months - 1));
                    return dealDate <= prevMonthEnd && endDateDeal >= prevMonthStart;
                });

                if (offerDeals.length === 0) {
                    results.push({ config_id: config.id, status: 'skipped', reason: 'No deals in period' });
                    continue;
                }

                // Calculate commission
                let commissionRate = 0.1;
                const commissionStr = String(offer.commission || '10');
                const match = commissionStr.match(/(\d+(?:\.\d+)?)/);
                if (match) commissionRate = parseFloat(match[1]) / 100;

                const fixedFee = offer.has_fixed_fee ? parseFloat(offer.fixed_fee_amount || '0') || 0 : 0;

                let totalCommissionHT = fixedFee;
                const lineItems: { description: string; count: number; total: number }[] = [];

                // Group deals
                const groups: Record<string, { description: string; count: number; total: number }> = {};

                offerDeals.forEach((deal: any) => {
                    const isInstallment = deal.payment_type === 'installments' || (deal.installments && deal.installments > 1);
                    const paymentLabel = isInstallment
                        ? `Mensualité (${deal.installments}x)`
                        : 'Paiement Comptant';
                    const key = `${offer.name}-${paymentLabel}`;
                    const fullValue = deal.value || 0;
                    const amountInPeriod = isInstallment ? fullValue / (deal.installments || 1) : fullValue;
                    const dealCommission = amountInPeriod * commissionRate;

                    if (!groups[key]) {
                        groups[key] = { description: `${offer.name} - ${paymentLabel}`, count: 0, total: 0 };
                    }
                    groups[key].count++;
                    groups[key].total += dealCommission;
                });

                Object.values(groups).forEach((g) => {
                    lineItems.push(g);
                    totalCommissionHT += g.total;
                });

                const tvaRate = config.tva_applicable ? 0.2 : 0;
                const tvaAmount = totalCommissionHT * tvaRate;
                const totalTTC = totalCommissionHT + tvaAmount;

                // 7. Generate invoice number
                const invoiceNumber = `FAC-AUTO-${today.getFullYear()}-${String(Date.now()).slice(-6)}`;

                // 8. Build HTML email
                const periodStr = `${prevMonthStart.toLocaleDateString('fr-FR')} au ${prevMonthEnd.toLocaleDateString('fr-FR')}`;

                const lineItemsHTML = lineItems
                    .map(
                        (item) => `
          <tr>
            <td style="padding: 10px 15px; border-bottom: 1px solid #e2e8f0; color: #334155;">${item.description}</td>
            <td style="padding: 10px 15px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #334155;">${item.count}</td>
            <td style="padding: 10px 15px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #334155; font-weight: bold;">${formatCurrency(item.total)}</td>
          </tr>
        `
                    )
                    .join('');

                const fixedFeeHTML =
                    fixedFee > 0
                        ? `
          <tr>
            <td style="padding: 10px 15px; border-bottom: 1px solid #e2e8f0; color: #334155;">Frais fixe mensuel</td>
            <td style="padding: 10px 15px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #334155;">1</td>
            <td style="padding: 10px 15px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #334155; font-weight: bold;">${formatCurrency(fixedFee)}</td>
          </tr>
        `
                        : '';

                const issuerHTML = issuerProfile
                    ? `
          <div style="margin-bottom: 20px;">
            <p style="font-weight: bold; color: #0f172a; margin: 0;">${issuerProfile.company_name || issuerProfile.name}</p>
            ${issuerProfile.address ? `<p style="margin: 2px 0; color: #475569; font-size: 13px;">${issuerProfile.address}</p>` : ''}
            ${issuerProfile.zip || issuerProfile.city ? `<p style="margin: 2px 0; color: #475569; font-size: 13px;">${issuerProfile.zip || ''} ${issuerProfile.city || ''}</p>` : ''}
            ${issuerProfile.country ? `<p style="margin: 2px 0; color: #475569; font-size: 13px;">${issuerProfile.country}</p>` : ''}
            ${issuerProfile.siret ? `<p style="margin: 2px 0; color: #475569; font-size: 13px;">SIRET : ${issuerProfile.siret}</p>` : ''}
            ${issuerProfile.email ? `<p style="margin: 2px 0; color: #475569; font-size: 13px;">Email : ${issuerProfile.email}</p>` : ''}
            ${issuerProfile.phone ? `<p style="margin: 2px 0; color: #475569; font-size: 13px;">Tél : ${issuerProfile.phone}</p>` : ''}
          </div>
        `
                    : '';

                const clientHTML = `
          <div style="margin-bottom: 20px;">
            <p style="font-size: 12px; color: #94a3b8; text-transform: uppercase; margin: 0 0 5px;">Facturé à</p>
            <p style="font-weight: bold; color: #0f172a; margin: 0;">${offer.billing_name || offer.company || 'Client'}</p>
            ${offer.billing_address ? `<p style="margin: 2px 0; color: #475569; font-size: 13px;">${offer.billing_address}</p>` : ''}
            ${offer.billing_zip || offer.billing_city ? `<p style="margin: 2px 0; color: #475569; font-size: 13px;">${offer.billing_zip || ''} ${offer.billing_city || ''}</p>` : ''}
            ${offer.billing_email ? `<p style="margin: 2px 0; color: #475569; font-size: 13px;">${offer.billing_email}</p>` : ''}
          </div>
        `;

                const paymentMethodHTML = getPaymentMethodHTML(paymentMethod);

                const htmlContent = `
        <html>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f1f5f9; padding: 30px;">
            <div style="max-width: 650px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
              
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 30px; color: white;">
                <h1 style="margin: 0; font-size: 22px;">Facture de Commission</h1>
                <p style="margin: 5px 0 0; opacity: 0.9; font-size: 14px;">N° ${invoiceNumber}</p>
                <p style="margin: 5px 0 0; opacity: 0.8; font-size: 13px;">Période : ${periodStr}</p>
              </div>

              <!-- Body -->
              <div style="padding: 30px;">
                
                <!-- Issuer + Client -->
                <div style="display: flex; justify-content: space-between; margin-bottom: 25px;">
                  <div style="flex: 1;">
                    <p style="font-size: 12px; color: #94a3b8; text-transform: uppercase; margin: 0 0 5px;">Émetteur</p>
                    ${issuerHTML || '<p style="color: #94a3b8; font-style: italic;">Non renseigné</p>'}
                  </div>
                  <div style="flex: 1; text-align: right;">
                    ${clientHTML}
                  </div>
                </div>

                <!-- Line items -->
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                  <thead>
                    <tr style="background-color: #f8fafc;">
                      <th style="padding: 10px 15px; text-align: left; font-size: 12px; color: #64748b; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">Description</th>
                      <th style="padding: 10px 15px; text-align: center; font-size: 12px; color: #64748b; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">Qté</th>
                      <th style="padding: 10px 15px; text-align: right; font-size: 12px; color: #64748b; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${lineItemsHTML}
                    ${fixedFeeHTML}
                  </tbody>
                </table>

                <!-- Totals -->
                <div style="background-color: #f8fafc; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span style="color: #64748b; font-size: 14px;">Total HT</span>
                    <span style="font-weight: bold; color: #334155;">${formatCurrency(totalCommissionHT)}</span>
                  </div>
                  ${config.tva_applicable
                        ? `
                  <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span style="color: #64748b; font-size: 14px;">TVA (20%)</span>
                    <span style="font-weight: bold; color: #334155;">${formatCurrency(tvaAmount)}</span>
                  </div>
                  `
                        : ''
                    }
                  <div style="display: flex; justify-content: space-between; padding-top: 10px; border-top: 2px solid #e2e8f0;">
                    <span style="font-weight: bold; color: #0f172a; font-size: 16px;">Total TTC</span>
                    <span style="font-weight: bold; color: #6366f1; font-size: 18px;">${formatCurrency(totalTTC)}</span>
                  </div>
                </div>

                <!-- Payment Method -->
                ${paymentMethodHTML}

              </div>

              <!-- Footer -->
              <div style="background-color: #f8fafc; padding: 15px 30px; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">
                  Facture générée automatiquement par CloseOS • ${today.toLocaleDateString('fr-FR')}
                </p>
              </div>

            </div>
          </body>
        </html>
        `;

                // 9. Insert invoice record
                const { error: insertError } = await supabaseAdmin.from('invoices').insert([
                    {
                        user_id: config.user_id,
                        invoice_number: invoiceNumber,
                        offer_name: offer.name,
                        client_name: offer.billing_name || offer.company || 'Client',
                        client_email: offer.billing_email || null,
                        amount_ht: totalCommissionHT,
                        amount_ttc: totalTTC,
                        status: 'envoyée',
                    },
                ]);

                if (insertError) {
                    console.error('Insert error:', insertError);
                    results.push({ config_id: config.id, status: 'error', error: insertError.message });
                    continue;
                }

                // 10. Send email to infopreneur
                if (offer.billing_email) {
                    const replyToEmail = issuerProfile?.email || 'support@closeos.fr';
                    const replyToName = issuerProfile?.company_name || issuerProfile?.name || 'CloseOS';

                    await sendEmailBrevo({
                        sender: { name: 'CloseOS Notification', email: 'support@closeos.fr' },
                        replyTo: { email: replyToEmail, name: replyToName },
                        to: [{ email: offer.billing_email, name: offer.billing_name || offer.company }],
                        subject: `Votre facture ${invoiceNumber} est disponible`,
                        htmlContent,
                    });
                }

                // 11. Send copy to user if enabled
                if (config.send_copy_to_user && userEmail) {
                    await sendEmailBrevo({
                        sender: { name: 'CloseOS Notification', email: 'support@closeos.fr' },
                        to: [{ email: userEmail, name: 'Copie facturation' }],
                        subject: `[Copie] Facture ${invoiceNumber} - ${offer.name}`,
                        htmlContent,
                    });
                }

                results.push({
                    config_id: config.id,
                    offer: offer.name,
                    status: 'success',
                    invoice: invoiceNumber,
                    amount: totalTTC,
                    deals: offerDeals.length,
                });
            } catch (err: any) {
                console.error(`Error processing config ${config.id}:`, err);
                results.push({ config_id: config.id, status: 'error', error: err.message });
            }
        }

        return new Response(
            JSON.stringify({
                processed: results.length,
                day: dayOfMonth,
                details: results,
            }),
            { headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error: any) {
        console.error('Cron error:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
