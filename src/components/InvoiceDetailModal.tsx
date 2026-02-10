import { useState, useEffect } from 'react';
import { X, Calendar, User, FileText, CheckCircle, Clock, AlertTriangle, HelpCircle, Save, Loader2, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Invoice {
  id: string;
  invoice_number: string;
  created_at: string;
  client_name: string;
  offer_name: string;
  amount_ttc: number;
  status: string;
  pdf_url: string;
  status_note?: string; // Pour le commentaire "Autre"
}

interface InvoiceDetailModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void; // Pour rafraîchir la liste après modif
}

export function InvoiceDetailModal({ invoice, isOpen, onClose, onUpdate }: InvoiceDetailModalProps) {
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Initialisation des données à l'ouverture
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
      const { error } = await supabase
        .from('invoices')
        .update({ 
          status: status,
          status_note: status === 'autre' ? note : null // On garde la note seulement si "Autre"
        })
        .eq('id', invoice.id);

      if (error) throw error;
      
      onUpdate(); // Rafraichir la liste parente
      onClose();
    } catch (err) {
      console.error('Erreur update:', err);
      alert("Erreur lors de la mise à jour");
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'payé': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
      case 'retard': return 'bg-rose-500/20 text-rose-400 border-rose-500/50';
      case 'en_attente': return 'bg-amber-500/20 text-amber-400 border-amber-500/50';
      default: return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl h-[85vh] bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl flex overflow-hidden">
        
        {/* BOUTON FERMER */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-slate-800/50 hover:bg-slate-700 text-white rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* --- PARTIE GAUCHE : VISUEL FACTURE (PDF) --- */}
        <div className="w-1/2 h-full bg-slate-950 border-r border-slate-800 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" /> 
              Aperçu du document
            </h3>
            <a 
              href={invoice.pdf_url} 
              target="_blank" 
              rel="noreferrer"
              className="text-xs flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <Download className="w-3 h-3" /> Ouvrir / Télécharger
            </a>
          </div>
          
          <div className="flex-1 bg-slate-900 rounded-lg border border-slate-800 overflow-hidden relative">
            {invoice.pdf_url ? (
              <iframe 
                src={`${invoice.pdf_url}#toolbar=0&navpanes=0&scrollbar=0`}
                className="w-full h-full object-contain"
                title="PDF Preview"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                Aperçu non disponible
              </div>
            )}
          </div>
        </div>

        {/* --- PARTIE DROITE : DÉTAILS & ACTIONS --- */}
        <div className="w-1/2 h-full p-8 overflow-y-auto bg-slate-900">
          
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white mb-1">{invoice.invoice_number}</h2>
            <p className="text-slate-400 text-sm">Générée le {new Date(invoice.created_at).toLocaleDateString('fr-FR')}</p>
          </div>

          <div className="space-y-8">
            
            {/* INFO CLIENT */}
            <div className="bg-slate-800/30 p-5 rounded-xl border border-slate-700/50">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Informations Client</h4>
              <div className="flex items-start gap-4">
                <div className="p-3 bg-indigo-500/10 rounded-lg">
                  <User className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">{invoice.client_name}</p>
                  <p className="text-slate-400 text-sm mt-1">{invoice.offer_name}</p>
                  <p className="text-xl font-bold text-white mt-2">
                    {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(invoice.amount_ttc)}
                  </p>
                </div>
              </div>
            </div>

            {/* GESTION ÉTAT */}
            <div className="bg-slate-800/30 p-5 rounded-xl border border-slate-700/50">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Statut du paiement</h4>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button 
                  onClick={() => setStatus('en_attente')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${status === 'en_attente' ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                >
                  <Clock className="w-4 h-4" /> En attente
                </button>

                <button 
                  onClick={() => setStatus('payé')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${status === 'payé' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                >
                  <CheckCircle className="w-4 h-4" /> Payé
                </button>

                <button 
                  onClick={() => setStatus('retard')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${status === 'retard' ? 'bg-rose-500/20 border-rose-500 text-rose-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                >
                  <AlertTriangle className="w-4 h-4" /> Retard
                </button>

                <button 
                  onClick={() => setStatus('autre')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${status === 'autre' ? 'bg-slate-200/10 border-slate-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                >
                  <HelpCircle className="w-4 h-4" /> Autre
                </button>
              </div>

              {/* CHAMPS TEXTE SI "AUTRE" */}
              {status === 'autre' && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                  <label className="block text-sm text-slate-400 mb-2">Précisez la situation :</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full h-24 bg-slate-900 border border-slate-700 rounded-lg p-3 text-white text-sm focus:border-indigo-500 focus:outline-none resize-none"
                    placeholder="Ex: Paiement échelonné accepté, virement en cours de validation..."
                  />
                </div>
              )}
            </div>

            {/* ACTION SAVE */}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Enregistrer les modifications
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}