import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2023-10-16',
});

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, currency, title, connectedAccountId, clientEmail } = req.body;

    if (!amount || !connectedAccountId) {
      throw new Error('Missing required parameters');
    }

    // Création de la session de paiement Checkout
    // L'option clé ici est "stripeAccount", qui crée la session AU NOM du closer
    const session = await stripe.checkout.sessions.create(
      {
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: currency || 'eur',
              product_data: {
                name: title || 'Facture de Commission',
              },
              unit_amount: Math.round(amount * 100), // Stripe attend des centimes
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        customer_email: clientEmail, // Pré-remplir l'email du client s'il est dispo
        success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.origin}/factures`,
      },
      {
        stripeAccount: connectedAccountId, // C'est ici que la magie Connect opère
      }
    );

    res.status(200).json({ url: session.url });

  } catch (error: any) {
    console.error('Stripe Session Error:', error);
    res.status(500).json({ error: error.message });
  }
}