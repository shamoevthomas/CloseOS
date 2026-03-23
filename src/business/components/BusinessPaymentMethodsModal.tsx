import { useState, useEffect } from 'react'
import { X, Plus, Pencil, Trash2, CreditCard, Building, Repeat, DollarSign, Check, Loader2, Star } from 'lucide-react'
import { cn } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'

export type PaymentMethodType = 'VIREMENT' | 'PAYPAL' | 'REVOLUT' | 'STRIPE'

export interface PaymentMethod {
  id: string
  type: PaymentMethodType
  name: string
  isDefault: boolean
  details: {
    bankName?: string
    iban?: string
    bic?: string
    accountHolder?: string
    paymentLink?: string
    identifier?: string
  }
}

interface BusinessPaymentMethodsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function BusinessPaymentMethodsModal({ isOpen, onClose }: BusinessPaymentMethodsModalProps) {
  const { ownerUserId, user } = useBusinessAuth()
  const effectiveUserId = ownerUserId || user?.id

  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Form state
  const [formType, setFormType] = useState<PaymentMethodType>('VIREMENT')
  const [formName, setFormName] = useState('')
  const [formBankName, setFormBankName] = useState('')
  const [formIban, setFormIban] = useState('')
  const [formBic, setFormBic] = useState('')
  const [formAccountHolder, setFormAccountHolder] = useState('')
  const [formIdentifier, setFormIdentifier] = useState('')
  const [formPaymentLink, setFormPaymentLink] = useState('')

  const fetchMethods = async () => {
    if (!effectiveUserId) return
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('created_at', { ascending: true })

      if (error) throw error

      if (data) {
        const mapped = data.map(m => ({
          id: m.id,
          type: m.type as PaymentMethodType,
          name: m.name,
          isDefault: m.is_default,
          details: m.details || {}
        }))
        setMethods(mapped)
      }
    } catch (err) {
      console.error('Erreur chargement paiements:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchMethods()
    }
  }, [isOpen, effectiveUserId])

  const saveMethod = async (method: PaymentMethod) => {
    if (!effectiveUserId) {
      alert('Session expirée')
      return
    }
    setIsLoading(true)
    try {
      const dbData = {
        user_id: effectiveUserId,
        name: method.name,
        type: method.type,
        is_default: method.isDefault,
        details: method.details
      }

      if (editingId) {
        await supabase.from('payment_methods').update(dbData).eq('id', editingId)
      } else {
        await supabase.from('payment_methods').insert([dbData])
      }

      await fetchMethods()
      resetForm()
    } catch (err) {
      console.error('Erreur sauvegarde:', err)
      alert('Erreur lors de la sauvegarde')
    } finally {
      setIsLoading(false)
    }
  }

  const deleteMethod = async (id: string) => {
    try {
      await supabase.from('payment_methods').delete().eq('id', id)
      await fetchMethods()
    } catch (err) {
      console.error('Erreur suppression:', err)
    }
  }

  const setDefault = async (id: string) => {
    if (!effectiveUserId) return
    try {
      await supabase.from('payment_methods').update({ is_default: false }).eq('user_id', effectiveUserId)
      await supabase.from('payment_methods').update({ is_default: true }).eq('id', id)
      await fetchMethods()
    } catch (err) {
      console.error('Erreur défaut:', err)
    }
  }

  const resetForm = () => {
    setIsAdding(false)
    setEditingId(null)
    setFormType('VIREMENT')
    setFormName('')
    setFormBankName('')
    setFormIban('')
    setFormBic('')
    setFormAccountHolder('')
    setFormIdentifier('')
    setFormPaymentLink('')
  }

  const handleEdit = (method: PaymentMethod) => {
    setEditingId(method.id)
    setIsAdding(true)
    setFormType(method.type)
    setFormName(method.name)
    setFormBankName(method.details.bankName || '')
    setFormIban(method.details.iban || '')
    setFormBic(method.details.bic || '')
    setFormAccountHolder(method.details.accountHolder || '')
    setFormIdentifier(method.details.identifier || '')
    setFormPaymentLink(method.details.paymentLink || '')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) return alert('Nom obligatoire')

    const method: PaymentMethod = {
      id: editingId || '',
      type: formType,
      name: formName,
      isDefault: methods.length === 0,
      details: {},
    }

    if (formType === 'VIREMENT') {
      method.details = { bankName: formBankName, iban: formIban, bic: formBic, accountHolder: formAccountHolder }
    } else if (formType === 'PAYPAL' || formType === 'REVOLUT') {
      method.details = { identifier: formIdentifier }
    } else if (formType === 'STRIPE') {
      method.details = { paymentLink: formPaymentLink }
    }

    saveMethod(method)
  }

  const getIcon = (type: PaymentMethodType) => {
    switch (type) {
      case 'VIREMENT': return <Building className="h-5 w-5" />
      case 'PAYPAL': return <CreditCard className="h-5 w-5" />
      case 'REVOLUT': return <Repeat className="h-5 w-5" />
      case 'STRIPE': return <DollarSign className="h-5 w-5" />
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl ring-1 ring-[#c4c7c7]/20 dark:ring-neutral-700 w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#c4c7c7]/10 dark:border-neutral-800 p-6 flex-shrink-0">
          <h2 className="text-2xl font-extrabold font-['Manrope'] text-[#1b1c1b] dark:text-white">
            Moyens de Paiement
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-[#444748] hover:bg-[#eae8e7] dark:hover:bg-neutral-800 dark:text-neutral-400 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Add button */}
          {!isAdding && (
            <button
              onClick={() => setIsAdding(true)}
              className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#c4c7c7]/30 dark:border-neutral-700 bg-[#f5f3f2]/50 dark:bg-neutral-800/50 px-4 py-4 text-sm font-semibold text-[#444748] dark:text-neutral-400 hover:border-[#006c49] hover:text-[#006c49] transition-colors"
            >
              <Plus className="h-4 w-4" /> Ajouter un moyen de paiement
            </button>
          )}

          {/* Add/Edit Form */}
          {isAdding && (
            <div className="mb-6 rounded-xl border border-[#c4c7c7]/10 dark:border-neutral-800 bg-[#f5f3f2]/50 dark:bg-neutral-800/50 p-6">
              <h3 className="mb-4 text-lg font-extrabold font-['Manrope'] text-[#1b1c1b] dark:text-white">
                {editingId ? 'Modifier' : 'Nouveau'} moyen de paiement
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#444748] dark:text-neutral-400">Nom</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ex: Compte principal"
                    className="w-full rounded-xl border border-[#c4c7c7]/20 dark:border-neutral-700 bg-[#f5f3f2] dark:bg-neutral-800 px-4 py-2.5 text-sm text-[#1b1c1b] dark:text-white focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49] outline-none transition-colors"
                    required
                  />
                </div>

                {/* Type selector */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#444748] dark:text-neutral-400">Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['VIREMENT', 'PAYPAL', 'REVOLUT', 'STRIPE'] as PaymentMethodType[]).map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormType(type)}
                        className={cn(
                          'flex items-center gap-2 rounded-xl border p-3 text-sm font-medium transition-all',
                          formType === type
                            ? 'border-[#006c49] bg-[#006c49]/10 text-[#006c49]'
                            : 'border-[#c4c7c7]/20 dark:border-neutral-700 bg-[#f5f3f2] dark:bg-neutral-800 text-[#444748] dark:text-neutral-300 hover:border-[#006c49]/50'
                        )}
                      >
                        {getIcon(type)} {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Type-specific fields */}
                {formType === 'VIREMENT' && (
                  <div className="space-y-3 rounded-xl border border-[#c4c7c7]/10 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-[#444748] dark:text-neutral-400">Banque</label>
                      <input
                        type="text"
                        placeholder="Nom de la banque"
                        value={formBankName}
                        onChange={e => setFormBankName(e.target.value)}
                        className="w-full rounded-xl border border-[#c4c7c7]/20 dark:border-neutral-700 bg-[#f5f3f2] dark:bg-neutral-800 px-4 py-2.5 text-sm text-[#1b1c1b] dark:text-white focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49] outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-[#444748] dark:text-neutral-400">IBAN</label>
                      <input
                        type="text"
                        placeholder="FR76 XXXX XXXX XXXX"
                        value={formIban}
                        onChange={e => setFormIban(e.target.value)}
                        className="w-full rounded-xl border border-[#c4c7c7]/20 dark:border-neutral-700 bg-[#f5f3f2] dark:bg-neutral-800 px-4 py-2.5 text-sm text-[#1b1c1b] dark:text-white focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49] outline-none transition-colors"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-[#444748] dark:text-neutral-400">BIC</label>
                      <input
                        type="text"
                        placeholder="BNPAFRPP"
                        value={formBic}
                        onChange={e => setFormBic(e.target.value)}
                        className="w-full rounded-xl border border-[#c4c7c7]/20 dark:border-neutral-700 bg-[#f5f3f2] dark:bg-neutral-800 px-4 py-2.5 text-sm text-[#1b1c1b] dark:text-white focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49] outline-none transition-colors"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-[#444748] dark:text-neutral-400">Titulaire</label>
                      <input
                        type="text"
                        placeholder="Nom du titulaire"
                        value={formAccountHolder}
                        onChange={e => setFormAccountHolder(e.target.value)}
                        className="w-full rounded-xl border border-[#c4c7c7]/20 dark:border-neutral-700 bg-[#f5f3f2] dark:bg-neutral-800 px-4 py-2.5 text-sm text-[#1b1c1b] dark:text-white focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49] outline-none transition-colors"
                        required
                      />
                    </div>
                  </div>
                )}

                {(formType === 'PAYPAL' || formType === 'REVOLUT') && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#444748] dark:text-neutral-400">
                      {formType === 'PAYPAL' ? 'Email PayPal' : 'Revtag'}
                    </label>
                    <input
                      type="text"
                      placeholder={formType === 'PAYPAL' ? 'email@paypal.com' : '@revtag'}
                      value={formIdentifier}
                      onChange={e => setFormIdentifier(e.target.value)}
                      className="w-full rounded-xl border border-[#c4c7c7]/20 dark:border-neutral-700 bg-[#f5f3f2] dark:bg-neutral-800 px-4 py-2.5 text-sm text-[#1b1c1b] dark:text-white focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49] outline-none transition-colors"
                      required
                    />
                  </div>
                )}

                {formType === 'STRIPE' && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#444748] dark:text-neutral-400">Lien de paiement Stripe</label>
                    <input
                      type="text"
                      placeholder="https://buy.stripe.com/..."
                      value={formPaymentLink}
                      onChange={e => setFormPaymentLink(e.target.value)}
                      className="w-full rounded-xl border border-[#c4c7c7]/20 dark:border-neutral-700 bg-[#f5f3f2] dark:bg-neutral-800 px-4 py-2.5 text-sm text-[#1b1c1b] dark:text-white focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49] outline-none transition-colors"
                      required
                    />
                  </div>
                )}

                {/* Form actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 rounded-xl border border-[#c4c7c7]/20 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-2.5 text-sm font-semibold text-[#444748] dark:text-neutral-300 hover:bg-[#eae8e7] dark:hover:bg-neutral-700 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 rounded-xl bg-[#1b1c1b] dark:bg-white px-4 py-2.5 text-sm font-semibold text-white dark:text-neutral-900 hover:bg-[#2d2e2d] dark:hover:bg-neutral-200 transition-colors flex justify-center items-center gap-2"
                  >
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (editingId ? 'Enregistrer' : 'Ajouter')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Empty state */}
          {methods.length === 0 && !isAdding && (
            <div className="rounded-xl border border-[#c4c7c7]/10 dark:border-neutral-800 bg-[#f5f3f2]/50 dark:bg-neutral-800/50 p-12 text-center">
              <CreditCard className="mx-auto mb-4 h-12 w-12 text-[#c4c7c7]" />
              <p className="text-[#444748] dark:text-neutral-400 font-medium">Aucun moyen de paiement.</p>
              <p className="mt-1 text-sm text-[#444748]/60 dark:text-neutral-500">
                Ajoutez un moyen de paiement pour vos factures.
              </p>
            </div>
          )}

          {/* Methods list */}
          {methods.length > 0 && (
            <div className="space-y-3">
              {methods.map((method) => (
                <div
                  key={method.id}
                  className="group rounded-xl border border-[#c4c7c7]/10 dark:border-neutral-800 bg-[#f5f3f2]/50 dark:bg-neutral-800/50 p-4 transition-all hover:border-[#c4c7c7]/30 dark:hover:border-neutral-700"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#006c49]/10 text-[#006c49]">
                      {getIcon(method.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-[#1b1c1b] dark:text-white">{method.name}</h4>
                        {method.isDefault && (
                          <span className="bg-[#006c49]/10 text-[#006c49] px-2 py-0.5 rounded-full text-xs font-bold inline-flex items-center gap-1">
                            <Check className="h-3 w-3" /> Défaut
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-[#444748] dark:text-neutral-400">
                        {method.type}
                        {method.type === 'VIREMENT' && method.details.iban && (
                          <span className="ml-2 text-[#444748]/60 dark:text-neutral-500">
                            {method.details.iban.slice(0, 8)}...
                          </span>
                        )}
                        {(method.type === 'PAYPAL' || method.type === 'REVOLUT') && method.details.identifier && (
                          <span className="ml-2 text-[#444748]/60 dark:text-neutral-500">
                            {method.details.identifier}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!method.isDefault && (
                        <button
                          onClick={() => setDefault(method.id)}
                          title="Définir par défaut"
                          className="rounded-lg p-2 text-[#444748] dark:text-neutral-400 hover:bg-[#eae8e7] dark:hover:bg-neutral-700 hover:text-[#006c49] transition-colors"
                        >
                          <Star className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(method)}
                        title="Modifier"
                        className="rounded-lg p-2 text-[#444748] dark:text-neutral-400 hover:bg-[#eae8e7] dark:hover:bg-neutral-700 hover:text-[#006c49] transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => confirm('Supprimer ce moyen de paiement ?') && deleteMethod(method.id)}
                        title="Supprimer"
                        className="rounded-lg p-2 text-[#444748] dark:text-neutral-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
