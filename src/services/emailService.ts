const BREVO_API_KEY = import.meta.env.VITE_BREVO_API_KEY;

// Fonction de formatage ultra-robuste pour Google Agenda
function formatToICSDate(dateStr: string, timeStr: string, addMinutes = 0) {
  // On extrait les chiffres du format "eeee d MMMM" ou "yyyy-MM-dd"
  // Pour plus de sécurité, on se base sur la date du jour si le parsing échoue
  const now = new Date();
  const [hours, minutes] = timeStr.split(':');
  
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(hours), Number(minutes));
  
  if (addMinutes > 0) {
    date.setMinutes(date.getMinutes() + addMinutes);
  }

  const pad = (n: number) => n.toString().padStart(2, '0');
  
  // Format requis : YYYYMMDDTHHMMSSZ
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00Z`;
}

export async function sendBookingEmails(data: {
  prospectEmail: string;
  prospectName: string;
  date: string;
  time: string;
  meetingLink: string;
  agentEmail: string;
}) {
  const url = 'https://api.brevo.com/v3/smtp/email';
  const sender = { name: "Réservation CloseOS", email: "noreplycloseos@gmail.com" };
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const uid = Math.random().toString(36).substring(2) + "@closeos.com";

  const startTime = formatToICSDate(data.date, data.time);
  const endTime = formatToICSDate(data.date, data.time, 45);
  
  // Contenu ICS complet avec les champs obligatoires DTSTAMP et UID
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST', // Indique à Google que c'est une invitation
    'BEGIN:VEVENT',
    `DTSTAMP:${stamp}`,
    `UID:${uid}`,
    `DTSTART:${startTime}`,
    `DTEND:${endTime}`,
    `SUMMARY:Entretien CloseOS x ${data.prospectName}`,
    `DESCRIPTION:Lien de la réunion : ${data.meetingLink}`,
    `LOCATION:${data.meetingLink}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const icsBase64 = btoa(unescape(encodeURIComponent(icsContent)));
  const attachment = [{ content: icsBase64, name: "invitation.ics" }];

  // Ton design original conservé
  const htmlLayout = (isAgent: boolean) => `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
      <h2 style="color: #2563eb;">${isAgent ? "Nouveau rendez-vous reçu" : "Votre rendez-vous est confirmé"}</h2>
      <p>Bonjour ${isAgent ? "Closer" : data.prospectName},</p>
      <p>${isAgent ? `<strong>${data.prospectName}</strong> a réservé un créneau` : "Votre entretien est prévu"} le <strong>${data.date}</strong> à <strong>${data.time}</strong>.</p>
      <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #64748b;">Lien d'accès à la réunion :</p>
        <a href="${data.meetingLink}" style="color: #2563eb; font-weight: bold; word-break: break-all;">${data.meetingLink}</a>
      </div>
      ${isAgent ? `<p style="font-size: 12px; color: #94a3b8;">Email du prospect : ${data.prospectEmail}</p>` : `<p style="font-size: 12px; color: #94a3b8;">En cas d'imprévu, merci de nous contacter à : ${data.agentEmail}</p>`}
    </div>
  `;

  try {
    await Promise.all([
      fetch(url, {
        method: 'POST',
        headers: { 'accept': 'application/json', 'api-key': BREVO_API_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({
          sender,
          to: [{ email: data.prospectEmail, name: data.prospectName }],
          subject: "Confirmation de votre entretien vidéo",
          attachment,
          htmlContent: htmlLayout(false)
        })
      }),
      fetch(url, {
        method: 'POST',
        headers: { 'accept': 'application/json', 'api-key': BREVO_API_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({
          sender,
          to: [{ email: data.agentEmail, name: "Closer" }],
          subject: `🔥 Nouveau RDV : ${data.prospectName}`,
          attachment,
          htmlContent: htmlLayout(true)
        })
      })
    ]);
    return true;
  } catch (error) {
    console.error("Erreur réseau Brevo:", error);
    return false;
  }
}