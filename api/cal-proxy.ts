// api/cal-proxy.ts

export default async function handler(req: any, res: any) {
  // 1. Headers CORS permissifs (mais SANS Credentials pour éviter le conflit)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // 2. Répondre OK immédiatement à la requête de pré-vérification (OPTIONS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { apiKey } = req.query;

  if (!apiKey) {
    return res.status(400).json({ error: 'API Key manquante' });
  }

  try {
    // 3. Appel à Cal.com
    // On utilise "global.fetch" qui est natif sous Node 18+ (standard Vercel)
    const targetUrl = `https://api.cal.com/v1/bookings?apiKey=${apiKey}&take=100&status=CANCELLED,ACCEPTED,REJECTED`;
    
    const response = await fetch(targetUrl);
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erreur Cal.com (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    
    // 4. Renvoi propre au frontend
    return res.status(200).json(data);

  } catch (error: any) {
    console.error("Proxy Error:", error);
    // On renvoie l'erreur exacte pour le débuggage
    return res.status(500).json({ 
        error: error.message || 'Erreur interne du proxy',
        details: error.toString() 
    });
  }
}