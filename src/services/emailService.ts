// Fonction de formatage corrigée pour utiliser la vraie date sélectionnée
function formatToICSDate(dateStr: string, timeStr: string, addMinutes = 0) {
  // Parsing de la date (format attendu: yyyy-MM-dd envoyé par PublicBooking)
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  // On crée l'objet date
  const date = new Date(year, month - 1, day, hours, minutes);
  
  if (addMinutes > 0) {
    date.setMinutes(date.getMinutes() + addMinutes);
  }

  const pad = (n: number) => n.toString().padStart(2, '0');
  
  // On génère le format YYYYMMDDTHHMMSSZ (Format absolu pour Google/ICS)
  const y = date.getFullYear();
  const mo = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const mi = pad(date.getMinutes());

  return `${y}${mo}${d}T${h}${mi}00`;
}

export async function sendBookingEmails(data: {
  prospectEmail: string;
  prospectName: string;
  date: string; // Reçoit YYYY-MM-DD
  time: string;
  meetingLink: string;
  agentEmail: string;
}) {
  const url = '/api/send-email';
  const sender = { name: "Réservation CloseOS", email: "noreplycloseos@gmail.com" };
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const uid = Math.random().toString(36).substring(2) + "@closeos.com";

  const startTime = formatToICSDate(data.date, data.time);
  const endTime = formatToICSDate(data.date, data.time, 30);
  
  // Lien Google Agenda corrigé (Format simple sans Z pour éviter les décalages de zone)
  const googleCalendarUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('Entretien CloseOS x ' + data.prospectName)}&dates=${startTime}/${endTime}&details=${encodeURIComponent('Lien de la réunion : ' + data.meetingLink)}&location=${encodeURIComponent(data.meetingLink)}`;

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
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

  const htmlLayout = (isAgent: boolean) => `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
      <h2 style="color: #2563eb; margin-top: 0;">${isAgent ? "Nouveau rendez-vous reçu" : "Votre rendez-vous est confirmé"}</h2>
      <p style="color: #475569;">Bonjour ${isAgent ? "Closer" : data.prospectName},</p>
      <p style="color: #475569;">${isAgent ? `<strong>${data.prospectName}</strong> a réservé un créneau` : "Votre entretien est prévu"} le <strong>${data.date}</strong> à <strong>${data.time}</strong>.</p>
      
      <div style="background-color: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; margin: 24px 0; text-align: center;">
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #64748b; font-weight: bold; text-transform: uppercase;">Lien d'accès à la réunion</p>
        <a href="${data.meetingLink}" style="color: #2563eb; font-weight: 800; font-size: 16px; text-decoration: none; word-break: break-all;">${data.meetingLink}</a>
      </div>

      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${googleCalendarUrl}" style="background-color: #0f172a; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">
          📅 Exporter dans mon agenda
        </a>
      </div>

      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;">
      
      <p style="font-size: 13px; color: #64748b; line-height: 1.6; text-align: center;">
        ${isAgent ? `Email du prospect : <strong>${data.prospectEmail}</strong>` : `Un empêchement ? Merci de nous prévenir par email à : <br><strong style="color: #2563eb;">${data.agentEmail}</strong>`}
      </p>
    </div>
  `;

  try {
    const payloadProspect = {
      sender,
      to: [{ email: data.prospectEmail, name: data.prospectName }],
      subject: "Confirmation de votre entretien vidéo",
      attachment,
      htmlContent: htmlLayout(false)
    };

    const payloadAgent = {
      sender,
      to: [{ email: data.agentEmail, name: "Closer" }],
      subject: `🔥 Nouveau RDV : ${data.prospectName}`,
      attachment,
      htmlContent: htmlLayout(true)
    };

    const responses = await Promise.all([
      fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payloadProspect)
      }),
      fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payloadAgent)
      })
    ]);

    return responses.every(r => r.ok);
  } catch (error) {
    console.error("Erreur d'envoi d'email:", error);
    return false;
  }
}