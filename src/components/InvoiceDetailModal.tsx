import { useState, useEffect } from 'react';
import { X, User, FileText, CheckCircle, Clock, AlertTriangle, HelpCircle, Save, Loader2, Download, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';

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
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // 🚀 État pour l'envoi d'email
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
        alert("Impossible de modifier cette facture. Vérifiez vos droits d'accès.");
        return;
      }

      onUpdate();
      onClose();
    } catch (err) {
      console.error('Erreur update:', err);
      alert("Erreur technique lors de la mise à jour");
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

      alert(`Facture envoyée à ${invoice.client_email}`);

      // Optionnel : Passer le statut en "envoyée" si ce n'est pas déjà fait
      if (status === 'générée') {
        setStatus('envoyée');
        // On sauvegarde silencieusement le changement de statut
        await supabase.from('invoices').update({ status: 'envoyée' }).eq('id', invoice.id);
        onUpdate();
      }

    } catch (err) {
      console.error("Erreur envoi:", err);
      alert("Impossible d'envoyer l'email.");
    } finally {
      setIsSendingEmail(false);
    }
  };


  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl h-[85vh] bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl flex overflow-hidden">

        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-slate-800/50 hover:bg-slate-700 text-white rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* GAUCHE: PDF */}
        <div className="w-1/2 h-full bg-slate-950 border-r border-slate-800 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              Aperçu du document
            </h3>
            <a href={invoice.pdf_url} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors">
              <Download className="w-3 h-3" /> Ouvrir / Télécharger
            </a>
          </div>
          <div className="flex-1 bg-slate-900 rounded-lg border border-slate-800 overflow-hidden relative">
            {invoice.pdf_url ? (
              <iframe src={`${invoice.pdf_url}#toolbar=0&navpanes=0&scrollbar=0`} className="w-full h-full object-contain" title="PDF Preview" />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">Aperçu non disponible</div>
            )}
          </div>
        </div>

        {/* DROITE: DÉTAILS */}
        <div className="w-1/2 h-full p-8 overflow-y-auto bg-slate-900">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white mb-1">{invoice.invoice_number}</h2>
            <p className="text-slate-400 text-sm">Générée le {new Date(invoice.created_at).toLocaleDateString('fr-FR')}</p>
          </div>

          <div className="space-y-8">
            <div className="bg-slate-800/30 p-5 rounded-xl border border-slate-700/50">
              <div className="flex justify-between items-start mb-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Informations Client</h4>

                {/* 🚀 BOUTON EMAIL */}
                <button
                  onClick={handleSendEmail}
                  disabled={!invoice.client_email || isSendingEmail}
                  className={`text-xs flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${!invoice.client_email
                    ? 'border-slate-700 text-slate-600 cursor-not-allowed bg-slate-800/50'
                    : 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20'
                    }`}
                  title={!invoice.client_email ? "Aucun email enregistré pour cette facture" : "Envoyer la facture par mail"}
                >
                  {isSendingEmail ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                  {isSendingEmail ? 'Envoi...' : 'Envoyer par mail'}
                </button>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-3 bg-indigo-500/10 rounded-lg"><User className="w-6 h-6 text-indigo-400" /></div>
                <div>
                  <p className="text-lg font-semibold text-white">{invoice.client_name}</p>
                  <p className="text-slate-400 text-sm mt-1">{invoice.offer_name}</p>
                  {invoice.client_email && <p className="text-slate-500 text-xs mt-0.5">{invoice.client_email}</p>}
                  <p className="text-xl font-bold text-white mt-2">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(invoice.amount_ttc)}</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/30 p-5 rounded-xl border border-slate-700/50">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Statut du paiement</h4>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button onClick={() => setStatus('en_attente')} className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${status === 'en_attente' ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}><Clock className="w-4 h-4" /> En attente</button>
                <button onClick={() => setStatus('payé')} className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${status === 'payé' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}><CheckCircle className="w-4 h-4" /> Payé</button>
                <button onClick={() => setStatus('retard')} className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${status === 'retard' ? 'bg-rose-500/20 border-rose-500 text-rose-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}><AlertTriangle className="w-4 h-4" /> Retard</button>
                <button onClick={() => setStatus('autre')} className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${status === 'autre' ? 'bg-slate-200/10 border-slate-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}><HelpCircle className="w-4 h-4" /> Autre</button>
              </div>
              {status === 'autre' && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                  <label className="block text-sm text-slate-400 mb-2">Précisez la situation :</label>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} className="w-full h-24 bg-slate-900 border border-slate-700 rounded-lg p-3 text-white text-sm focus:border-indigo-500 focus:outline-none resize-none" placeholder="Ex: Paiement échelonné accepté..." />
                </div>
              )}
            </div>

            <button onClick={handleSave} disabled={isSaving} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed">
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Enregistrer les modifications
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}