import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Headers CORS pour autoriser ton site à parler à ce proxy
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // 2. Répondre OK tout de suite si le navigateur demande la permission (Preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { apiKey } = req.query;

  if (!apiKey) {
    return res.status(400).json({ error: 'API Key manquante' });
  }

  try {
    // 3. Appel Serveur vers Cal.com (Ici, pas de blocage CORS car on est côté serveur)
    const response = await fetch(
      `https://api.cal.com/v1/bookings?apiKey=${apiKey}&take=100&status=CANCELLED,ACCEPTED,REJECTED`
    );
    
    if (!response.ok) {
        throw new Error(`Erreur Cal.com: ${response.statusText}`);
    }

    const data = await response.json();
    
    // 4. On renvoie les données propres à ton site
    return res.status(200).json(data);

  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erreur interne' });
  }
}