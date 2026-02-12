// api/cal-bookings.ts
export default async function handler(req: any, res: any) {
  // 1. Autoriser tout le monde (CORS)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { apiKey } = req.query;

  if (!apiKey) {
    return res.status(400).json({ error: 'Clé API manquante' });
  }

  try {
    // 2. Appel sécurisé à Cal.com (C'est ici qu'on demande les statuts)
    const url = `https://api.cal.com/v1/bookings?apiKey=${apiKey}&take=100&status=CANCELLED,ACCEPTED,REJECTED`;
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`Erreur Cal.com: ${response.statusText}`);
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (error: any) {
    console.error("Erreur Proxy:", error);
    return res.status(500).json({ error: error.message });
  }
}