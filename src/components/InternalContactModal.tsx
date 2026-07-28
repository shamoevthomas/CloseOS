import { useState, useEffect } from 'react'
import { X, Mail, Phone, User as UserIcon, Briefcase, Pencil, Trash2, Save } from 'lucide-react'
import { type InternalContact } from '../contexts/InternalContactsContext'
import { useOffers } from '../contexts/OffersContext'
import { useLanguage } from '../contexts/LanguageContext'

interface InternalContactModalProps {
  contact: InternalContact
  onClose: () => void
  onEdit: (contact: InternalContact) => void
  onDelete: (id: number) => void
}

export function InternalContactModal({ contact, onClose, onEdit, onDelete }: InternalContactModalProps) {
  const { offers } = useOffers()
  const { lang } = useLanguage()

  // Editing state
  const [isEditing, setIsEditing] = useState(false)
  const [editedContact, setEditedContact] = useState<InternalContact>(contact)

  // Update editedContact when contact prop changes
  useEffect(() => {
    setEditedContact(contact)
  }, [contact])

  // Get initials from name
  const getInitials = (name: string) => {
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  const handleDelete = () => {
    if (confirm(lang === 'fr' ? `Êtes-vous sûr de vouloir supprimer ${contact.name} ?` : `Are you sure you want to delete ${contact.name}?`)) {
      onDelete(contact.id)
      onClose()
    }
  }

  const handleSave = () => {
    if (!editedContact.name || !editedContact.role || !editedContact.email || !editedContact.phone) {
      alert(lang === 'fr' ? 'Veuillez remplir tous les champs obligatoires' : 'Please fill in all required fields')
      return
    }
    onEdit(editedContact)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditedContact(contact)
    setIsEditing(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal - Business Card Style */}
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto animate-scale-in rounded-2xl bg-white dark:bg-[#1a1a1a] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_14px_34px_-16px_rgba(15,23,42,0.10)] ring-1 ring-slate-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 dark:text-neutral-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header - Avatar & Name */}
        <div className="border-b border-slate-200 dark:border-white/10 bg-gradient-to-r from-sky-500/10 to-sky-600/10 p-8 text-center">
          <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-sky-600 text-3xl font-bold text-slate-900 dark:text-white shadow-lg">
            {getInitials(contact.name)}
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{contact.name}</h2>
          <div className="mt-2 flex items-center justify-center gap-2">
            <Briefcase className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            <p className="text-sm text-sky-600 dark:text-sky-400">{contact.role}</p>
          </div>
        </div>

        {/* Body - Contact Info */}
        <div className="p-6">
          <div className="space-y-4">
            {isEditing ? (
              <>
                {/* Editing Mode - Name */}
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-widest font-bold text-slate-400 dark:text-neutral-500">
                    {lang === 'fr' ? 'Nom complet' : 'Full name'}
                  </label>
                  <input
                    type="text"
                    value={editedContact.name}
                    onChange={(e) => setEditedContact({ ...editedContact, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:border-sky-500 focus:outline-none"
                    placeholder={lang === 'fr' ? "Ex: Jean Dupont" : "E.g.: John Doe"}
                  />
                </div>

                {/* Editing Mode - Role */}
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-widest font-bold text-slate-400 dark:text-neutral-500">
                    {lang === 'fr' ? 'Rôle/Poste' : 'Role/Position'}
                  </label>
                  <input
                    type="text"
                    value={editedContact.role}
                    onChange={(e) => setEditedContact({ ...editedContact, role: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:border-sky-500 focus:outline-none"
                    placeholder={lang === 'fr' ? "Ex: Directeur Commercial" : "E.g.: Sales Director"}
                  />
                </div>

                {/* Editing Mode - Email */}
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-widest font-bold text-slate-400 dark:text-neutral-500">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editedContact.email}
                    onChange={(e) => setEditedContact({ ...editedContact, email: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:border-sky-500 focus:outline-none"
                    placeholder="Ex: jean@closeros.com"
                  />
                </div>

                {/* Editing Mode - Phone */}
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-widest font-bold text-slate-400 dark:text-neutral-500">
                    {lang === 'fr' ? 'Téléphone' : 'Phone'}
                  </label>
                  <input
                    type="tel"
                    value={editedContact.phone}
                    onChange={(e) => setEditedContact({ ...editedContact, phone: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:border-sky-500 focus:outline-none"
                    placeholder={lang === 'fr' ? "Ex: +33 6 12 34 56 78" : "E.g.: +1 555 123 4567"}
                  />
                </div>

                {/* Editing Mode - Notes */}
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-widest font-bold text-slate-400 dark:text-neutral-500">
                    {lang === 'fr' ? 'Notes (optionnel)' : 'Notes (optional)'}
                  </label>
                  <textarea
                    value={editedContact.notes || ''}
                    onChange={(e) => setEditedContact({ ...editedContact, notes: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:border-sky-500 focus:outline-none"
                    rows={3}
                    placeholder={lang === 'fr' ? "Ajouter des notes..." : "Add notes..."}
                  />
                </div>

                {/* SUPPRESSION DE LA PARTIE OFFRE/FACTURATION EN ÉDITION */}
              </>
            ) : (
              <>
                {/* View Mode - Email */}
                <div className="group rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4 transition-all hover:border-sky-500/50 hover:bg-slate-50">
                  <div className="mb-1 flex items-center gap-2">
                    <Mail className="h-4 w-4 text-slate-400 dark:text-neutral-500 group-hover:text-sky-600" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-500">Email</span>
                  </div>
                  <a
                    href={`mailto:${contact.email}`}
                    className="block text-sm text-sky-600 dark:text-sky-400 hover:underline"
                  >
                    {contact.email}
                  </a>
                </div>

                {/* View Mode - Phone */}
                <div className="group rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4 transition-all hover:border-sky-500/50 hover:bg-slate-50">
                  <div className="mb-1 flex items-center gap-2">
                    <Phone className="h-4 w-4 text-slate-400 dark:text-neutral-500 group-hover:text-sky-600" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'Téléphone' : 'Phone'}</span>
                  </div>
                  <a
                    href={`tel:${contact.phone}`}
                    className="block text-sm text-slate-500 dark:text-neutral-400 hover:text-slate-900"
                  >
                    {contact.phone}
                  </a>
                </div>

                {/* View Mode - Notes (if any) */}
                {contact.notes && (
                  <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-500">Notes</div>
                    <p className="text-sm leading-relaxed text-slate-500 dark:text-neutral-400">{contact.notes}</p>
                  </div>
                )}

                {/* SUPPRESSION DE LA PARTIE OFFRE/FACTURATION EN AFFICHAGE */}
              </>
            )}
          </div>
        </div>

        {/* Footer - Actions */}
        <div className="border-t border-slate-200 dark:border-white/10 p-6">
          {isEditing ? (
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-sky-600"
              >
                <Save className="h-4 w-4" />
                {lang === 'fr' ? 'Sauvegarder' : 'Save'}
              </button>
              <button
                onClick={handleCancel}
                className="flex flex-1 items-center justify-center gap-2 rounded-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-neutral-300 transition-all hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
                {lang === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => setIsEditing(true)}
                className="flex flex-1 items-center justify-center gap-2 rounded-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-neutral-300 transition-all hover:bg-slate-100"
              >
                <Pencil className="h-4 w-4" />
                {lang === 'fr' ? 'Modifier' : 'Edit'}
              </button>
              <button
                onClick={handleDelete}
                className="flex flex-1 items-center justify-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-600 transition-all hover:bg-red-500/20"
              >
                <Trash2 className="h-4 w-4" />
                {lang === 'fr' ? 'Supprimer' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }

        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }

        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}