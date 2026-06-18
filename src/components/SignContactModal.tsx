import { useRef, useState } from 'react';
import { X, Paperclip, Send, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * CloseOS Sign — modal de contact support (DA Sign : dark + lime).
 * Même backend que Sales/Business : POST /api/contact-form (action=contact-form, Brevo → support@closeos.fr).
 */

const CATEGORIES = [
  { value: 'Help', label: 'Aide / question' },
  { value: 'Bug', label: 'Signaler un bug' },
  { value: 'Feature', label: 'Suggestion de fonctionnalité' },
  { value: 'Billing', label: 'Facturation / abonnement' },
  { value: 'Partnership', label: 'Partenariat' },
  { value: 'Other', label: 'Autre' },
];

export default function SignContactModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const fileRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setName(''); setEmail(''); setCategory(''); setSubject(''); setMessage(''); setAttachment(null); setStatus('idle');
  };

  const close = () => { resetForm(); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    try {
      let attachmentBase64: string | undefined;
      let attachmentType: string | undefined;
      let attachmentName: string | undefined;
      if (attachment) {
        attachmentName = attachment.name;
        attachmentType = attachment.type;
        const buffer = await attachment.arrayBuffer();
        attachmentBase64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      }
      const catLabel = CATEGORIES.find((c) => c.value === category)?.label || category;
      const res = await fetch('/api/contact-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject: `[CloseOS Sign] [${catLabel}] ${subject}`, message, attachmentBase64, attachmentName, attachmentType }),
      });
      if (!res.ok) throw new Error();
      setStatus('success');
      setTimeout(() => close(), 2200);
    } catch {
      setStatus('error');
    }
  };

  if (!open) return null;

  const field = 'w-full rounded-lg border border-[#3A4242] bg-[#191E1E] px-3 py-2 text-sm text-[#F3F4F6] outline-none transition-colors placeholder:text-[#6b7373] focus:border-[#CEFF8F] focus:ring-1 focus:ring-[#CEFF8F]';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={close}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#3A4242] bg-[#222828] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#3A4242] p-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-white">Contacter le support</h2>
            <p className="mt-0.5 text-xs text-[#A1A9A9]">On vous répond sous 24 h ouvrées.</p>
          </div>
          <button onClick={close} className="rounded-lg p-1 text-[#A1A9A9] transition-colors hover:bg-[#191E1E] hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#F3F4F6]">Nom</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Votre nom" className={field} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#F3F4F6]">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.fr" className={field} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#F3F4F6]">Catégorie</label>
            <select required value={category} onChange={(e) => setCategory(e.target.value)} className={`${field} appearance-none`}>
              <option value="" disabled>Choisir une catégorie</option>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#F3F4F6]">Objet</label>
            <input type="text" required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Résumé en quelques mots" className={field} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#F3F4F6]">Message</label>
            <textarea required rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Décrivez votre demande…" className={`${field} resize-none`} />
          </div>

          <div>
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => setAttachment(e.target.files?.[0] || null)} />
            <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-2 text-sm text-[#A1A9A9] transition-colors hover:text-[#CEFF8F]">
              <Paperclip className="h-4 w-4" />
              {attachment ? attachment.name : 'Joindre un fichier (optionnel)'}
            </button>
          </div>

          {status === 'success' && (
            <div className="flex items-center gap-2 rounded-lg border border-[#CEFF8F]/30 bg-[#CEFF8F]/10 px-3 py-2 text-sm text-[#CEFF8F]">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> Message envoyé. Merci, on revient vers vous vite.
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-center gap-2 rounded-lg border border-[#ef6b6b]/30 bg-[#ef6b6b]/10 px-3 py-2 text-sm text-[#ef6b6b]">
              <AlertCircle className="h-4 w-4 shrink-0" /> Envoi impossible. Réessayez ou écrivez à support@closeos.fr.
            </div>
          )}

          <button type="submit" disabled={status === 'sending' || status === 'success'}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#CEFF8F] py-2.5 text-sm font-semibold text-[#191E1E] transition-colors hover:bg-[#bdf06f] disabled:opacity-60">
            {status === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {status === 'sending' ? 'Envoi…' : 'Envoyer le message'}
          </button>
        </form>
      </div>
    </div>
  );
}
