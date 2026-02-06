import Stripe from 'stripe';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    try {
      const { session_id } = req.query;

      // On demande à Stripe les détails de cette session précise
      const session = await stripe.checkout.sessions.retrieve(session_id as string);

      // On renvoie le statut et l'email du client à ta page React
      res.status(200).json({
        status: session.status,
        customer_email: session.customer_details?.email
      });
    } catch (err: any) {
      res.status(err.statusCode || 500).json(err.message);
    }
  } else {
    res.setHeader('Allow', 'GET');
    res.status(405).end('Method Not Allowed');
  }
}