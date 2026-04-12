import { useState, useEffect } from 'react';
import { X, User, FileText, CheckCircle, Clock, AlertTriangle, HelpCircle, Save, Loader2, Download, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';

interface Invoice {
  id: string;
  invoice_number: string;
  created_at: string;
  client_name: string;
  client_email?: string; // 👈 Ajout du champ email
  offer_name: string;
  amount_ttc: number;
  status: string;
  pdf_url: string;
  status_note?: string;
}

interface InvoiceDetailModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function InvoiceDetailModal({ invoice, isOpen, onClose, onUpdate }: InvoiceDetailModalProps) {
  const { lang } = useLanguage();
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [isSendingEmail, setIsSendingEmail] = useState(false);

  useEffect(() => {
    if (invoice) {
      setStatus(invoice.status || 'générée');
      setNote(invoice.status_note || '');
    }
  }, [invoice]);

  if (!isOpen || !invoice) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .update({
          status: status,
          status_note: status === 'autre' ? note : null
        })
        .eq('id', invoice.id)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        alert(lang === 'fr' ? "Impossible de modifier cette facture. Vérifiez vos droits d'accès." : "Unable to modify this invoice. Check your access rights.");
        return;
      }

      onUpdate();
      onClose();
    } catch (err) {
      console.error('Erreur update:', err);
      alert(lang === 'fr' ? "Erreur technique lors de la mise à jour" : "Technical error during update");
    } finally {
      setIsSaving(false);
    }
  };

  // 🚀 Fonction d'envoi d'email
  const handleSendEmail = async () => {
    if (!invoice.client_email) return;

    setIsSendingEmail(true);
    try {
      // On récupère l'utilisateur courant pour le replyTo (optionnel, sinon support par défaut)
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email || "support@closeos.fr";

      const emailPayload = {
        sender: { name: "CloseOS Notification", email: "support@closeos.fr" },
        replyTo: { email: userEmail, name: "Service Facturation" },
        to: [{ email: invoice.client_email, name: invoice.client_name }],
        subject: `Votre facture ${invoice.invoice_number} est disponible`,
        htmlContent: `
          <html>
            <body>
              <h1>Bonjour ${invoice.client_name},</h1>
              <p>Veuillez trouver ci-joint votre facture n° <strong>${invoice.invoice_number}</strong>.</p>
              <p>Vous pouvez la télécharger directement ici : <br>
              <a href="${invoice.pdf_url}">👉 Télécharger ma facture (PDF)</a></p>
              <br>
              <p>Cordialement,</p>
            </body>
          </html>
        `,
        attachment: [
          {
            url: invoice.pdf_url,
            name: `${invoice.invoice_number}.pdf`
          }
        ]
      };

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailPayload)
      });

      if (!response.ok) throw new Error("Erreur API Email");

      alert(lang === 'fr' ? `Facture envoyée à ${invoice.client_email}` : `Invoice sent to ${invoice.client_email}`);

      // Optionnel : Passer le statut en "envoyée" si ce n'est pas déjà fait
      if (status === 'générée') {
        setStatus('envoyée');
        // On sauvegarde silencieusement le changement de statut
        await supabase.from('invoices').update({ status: 'envoyée' }).eq('id', invoice.id);
        onUpdate();
      }

    } catch (err) {
      console.error("Erreur envoi:", err);
      alert(lang === 'fr' ? "Impossible d'envoyer l'email." : "Unable to send the email.");
    } finally {
      setIsSendingEmail(false);
    }
  };


  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl h-[85vh] bg-[#1a1a1a] rounded-2xl border border-white/[0.08] shadow-2xl flex overflow-hidden">

        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-white/[0.03] border border-white/[0.08] hover:bg-white/10 text-white rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* GAUCHE: PDF */}
        <div className="w-1/2 h-full bg-[#111111] border-r border-white/[0.08] p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              {lang === 'fr' ? 'Aperçu du document' : 'Document Preview'}
            </h3>
            <a href={invoice.pdf_url} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors">
              <Download className="w-3 h-3" /> {lang === 'fr' ? 'Ouvrir / Télécharger' : 'Open / Download'}
            </a>
          </div>
          <div className="flex-1 bg-white/[0.03] rounded-2xl border border-white/[0.08] overflow-hidden relative">
            {invoice.pdf_url ? (
              <iframe src={`${invoice.pdf_url}#toolbar=0&navpanes=0&scrollbar=0`} className="w-full h-full object-contain" title="PDF Preview" />
            ) : (
              <div className="flex items-center justify-center h-full text-white/40">{lang === 'fr' ? 'Aperçu non disponible' : 'Preview not available'}</div>
            )}
          </div>
        </div>

        {/* DROITE: DÉTAILS */}
        <div className="w-1/2 h-full p-8 overflow-y-auto bg-[#1a1a1a]">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white mb-1">{invoice.invoice_number}</h2>
            <p className="text-white/40 text-sm">{lang === 'fr' ? 'Générée le' : 'Generated on'} {new Date(invoice.created_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')}</p>
          </div>

          <div className="space-y-8">
            <div className="bg-white/[0.03] backdrop-blur-2xl p-5 rounded-2xl border border-white/[0.08]">
              <div className="flex justify-between items-start mb-4">
                <h4 className="text-xs uppercase tracking-widest font-bold text-white/40">{lang === 'fr' ? 'Informations Client' : 'Client Information'}</h4>

                {/* 🚀 BOUTON EMAIL */}
                <button
                  onClick={handleSendEmail}
                  disabled={!invoice.client_email || isSendingEmail}
                  className={`text-xs flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${!invoice.client_email
                    ? 'border-white/[0.08] text-white/40 cursor-not-allowed bg-white/[0.03]'
                    : 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20'
                    }`}
                  title={!invoice.client_email ? (lang === 'fr' ? "Aucun email enregistré pour cette facture" : "No email registered for this invoice") : (lang === 'fr' ? "Envoyer la facture par mail" : "Send invoice by email")}
                >
                  {isSendingEmail ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                  {isSendingEmail ? (lang === 'fr' ? 'Envoi...' : 'Sending...') : (lang === 'fr' ? 'Envoyer par mail' : 'Send by email')}
                </button>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-3 bg-indigo-500/10 rounded-lg"><User className="w-6 h-6 text-indigo-400" /></div>
                <div>
                  <p className="text-lg font-semibold text-white">{invoice.client_name}</p>
                  <p className="text-white/40 text-sm mt-1">{invoice.offer_name}</p>
                  {invoice.client_email && <p className="text-white/40 text-xs mt-0.5">{invoice.client_email}</p>}
                  <p className="text-xl font-bold text-white mt-2">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(invoice.amount_ttc)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white/[0.03] backdrop-blur-2xl p-5 rounded-2xl border border-white/[0.08]">
              <h4 className="text-xs uppercase tracking-widest font-bold text-white/40 mb-4">{lang === 'fr' ? 'Statut du paiement' : 'Payment Status'}</h4>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button onClick={() => setStatus('en_attente')} className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${status === 'en_attente' ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-white/5 border-white/[0.08] text-white/40 hover:bg-white/10'}`}><Clock className="w-4 h-4" /> {lang === 'fr' ? 'En attente' : 'Pending'}</button>
                <button onClick={() => setStatus('payé')} className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${status === 'payé' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-white/5 border-white/[0.08] text-white/40 hover:bg-white/10'}`}><CheckCircle className="w-4 h-4" /> {lang === 'fr' ? 'Payé' : 'Paid'}</button>
                <button onClick={() => setStatus('retard')} className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${status === 'retard' ? 'bg-rose-500/20 border-rose-500 text-rose-400' : 'bg-white/5 border-white/[0.08] text-white/40 hover:bg-white/10'}`}><AlertTriangle className="w-4 h-4" /> {lang === 'fr' ? 'Retard' : 'Late'}</button>
                <button onClick={() => setStatus('autre')} className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${status === 'autre' ? 'bg-white/10 border-white/40 text-white' : 'bg-white/5 border-white/[0.08] text-white/40 hover:bg-white/10'}`}><HelpCircle className="w-4 h-4" /> {lang === 'fr' ? 'Autre' : 'Other'}</button>
              </div>
              {status === 'autre' && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                  <label className="block text-sm text-white/40 mb-2">{lang === 'fr' ? 'Précisez la situation :' : 'Specify the situation:'}</label>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} className="w-full h-24 bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm focus:border-emerald-500 focus:outline-none resize-none" placeholder={lang === 'fr' ? "Ex: Paiement échelonné accepté..." : "E.g.: Installment payment accepted..."} />
                </div>
              )}
            </div>

            <button onClick={handleSave} disabled={isSaving} className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-full flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} {lang === 'fr' ? 'Enregistrer les modifications' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}