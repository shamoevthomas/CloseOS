// Fonction de formatage pour Google Calendar (inchangée)
function formatToICSDate(dateStr: string, timeStr: string, addMinutes = 0) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  const date = new Date(year, month - 1, day, hours, minutes);
  
  if (addMinutes > 0) {
    date.setMinutes(date.getMinutes() + addMinutes);
  }

  const pad = (n: number) => n.toString().padStart(2, '0');
  
  const y = date.getFullYear();
  const mo = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const mi = pad(date.getMinutes());

  return `${y}${mo}${d}T${h}${mi}00Z`;
}

export async function sendBookingEmails(data: {
  prospectEmail: string;
  prospectName: string;
  date: string;
  time: string;
  meetingLink: string;
  agentEmail: string;
  duration: number;
}) {
  const url = '/api/send-email';
  const sender = { name: "Réservation CloseOS", email: "noreplycloseos@gmail.com" };
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const uid = Math.random().toString(36).substring(2) + "@closeos.com";

  const startTime = formatToICSDate(data.date, data.time);
  const endTime = formatToICSDate(data.date, data.time, data.duration); 
  
  // --- 1. MISE À JOUR DU LIEN GOOGLE AGENDA ---
  const eventTitle = `Session Stratégique x ${data.prospectName}`;
  const eventLocation = "À définir"; // Plus générique
  // Votre phrase exacte ici pour la description de l'agenda
  const eventDetails = "L'expert prendra contact avec vous au plus vite ou quelques temps avant le rendez-vous pour préciser les modalités.";

  const googleCalendarUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventTitle)}&dates=${startTime}/${endTime}&details=${encodeURIComponent(eventDetails)}&location=${encodeURIComponent(eventLocation)}`;

  // --- 2. MISE À JOUR DU FICHIER ICS ---
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
    `SUMMARY:${eventTitle}`,
    `DESCRIPTION:${eventDetails}`,
    `LOCATION:${eventLocation}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const icsBase64 = btoa(unescape(encodeURIComponent(icsContent)));
  const attachment = [{ content: icsBase64, name: "invitation.ics" }];

  // --- 3. NOUVEAU DESIGN HTML ---
  const htmlLayout = (isAgent: boolean) => `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
      <h2 style="color: #2563eb; margin-top: 0;">${isAgent ? "Nouveau rendez-vous reçu 📞" : "Votre rendez-vous est confirmé ✅"}</h2>
      
      <p style="color: #475569;">Bonjour ${isAgent ? "Closer" : data.prospectName},</p>
      
      <p style="color: #475569;">
        ${isAgent 
          ? `<strong>${data.prospectName}</strong> a réservé une session stratégique.` 
          : "Votre session stratégique est bien programmée."}
      </p>
      
      <div style="background-color: #f8fafc; padding: 20px; border-left: 4px solid #2563eb; border-radius: 4px; margin: 24px 0;">
        <p style="margin: 5px 0;"><strong>📅 Date :</strong> ${data.date}</p>
        <p style="margin: 5px 0;"><strong>⏰ Heure :</strong> ${data.time}</p>
        <p style="margin: 5px 0;"><strong>⏳ Durée :</strong> ${data.duration} minutes</p>
        <p style="margin: 5px 0; color: #2563eb;"><strong>📍 Lieu :</strong> À définir avec l'expert</p>
      </div>

      ${!isAgent ? `
        <div style="text-align: center; margin: 30px 0; padding: 15px; background-color: #eff6ff; border-radius: 8px; color: #1e40af;">
          <strong>👉 L'expert prendra contact avec vous au plus vite ou quelques temps avant le rendez-vous.</strong><br>
          <span style="font-size: 13px;">Surveillez vos emails et votre téléphone.</span>
        </div>
      ` : `
        <div style="text-align: center; margin: 30px 0; padding: 15px; background-color: #fff7ed; border-radius: 8px; color: #9a3412;">
          <strong>Action requise :</strong> Contactez le prospect avant le RDV.
        </div>
      `}

      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${googleCalendarUrl}" style="background-color: #0f172a; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">
          📅 Ajouter à mon agenda
        </a>
      </div>

      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;">
      
      <p style="font-size: 13px; color: #64748b; line-height: 1.6; text-align: center;">
        ${isAgent 
          ? `Email du prospect : <strong>${data.prospectEmail}</strong>` 
          : `Un empêchement ? Merci de nous prévenir par email à : <br><strong style="color: #2563eb;">${data.agentEmail}</strong>`}
      </p>
    </div>
  `;

  try {
    const payloadProspect = {
      sender,
      to: [{ email: data.prospectEmail, name: data.prospectName }],
      subject: "Confirmation de votre session stratégique",
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