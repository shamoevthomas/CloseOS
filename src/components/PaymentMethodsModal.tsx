import { useState, useEffect } from 'react'
import { X, Plus, Edit2, Trash2, CreditCard, Building, Repeat, DollarSign, Check } from 'lucide-react'
import { cn } from '../lib/utils'

export type PaymentMethodType = 'VIREMENT' | 'PAYPAL' | 'REVOLUT' | 'STRIPE'

export interface PaymentMethod {
  id: string
  type: PaymentMethodType
  name: string
  isDefault: boolean
  details: {
    // For VIREMENT
    bankName?: string
    iban?: string
    bic?: string
    accountHolder?: string
    // For others
    paymentLink?: string
    identifier?: string
  }
}

interface PaymentMethodsModalProps {
  isOpen: boolean
  onClose: () => void
}

const STORAGE_KEY = 'closeros_payment_methods'

export function PaymentMethodsModal({ isOpen, onClose }: PaymentMethodsModalProps) {
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form state
  const [formType, setFormType] = useState<PaymentMethodType>('VIREMENT')
  const [formName, setFormName] = useState('')
  const [formBankName, setFormBankName] = useState('')
  const [formIban, setFormIban] = useState('')
  const [formBic, setFormBic] = useState('')
  const [formAccountHolder, setFormAccountHolder] = useState('')
  const [formIdentifier, setFormIdentifier] = useState('')
  const [formPaymentLink, setFormPaymentLink] = useState('')

  // Load methods from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      setMethods(JSON.parse(saved))
    }
  }, [])

  // Save methods to localStorage
  const saveMethod = (method: PaymentMethod) => {
    const newMethods = editingId
      ? methods.map((m) => (m.id === editingId ? method : m))
      : [...methods, method]

    setMethods(newMethods)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newMethods))
    resetForm()
  }

  const deleteMethod = (id: string) => {
    const newMethods = methods.filter((m) => m.id !== id)
    setMethods(newMethods)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newMethods))
  }

  const setDefault = (id: string) => {
    const newMethods = methods.map((m) => ({
      ...m,
      isDefault: m.id === id,
    }))
    setMethods(newMethods)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newMethods))
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

    if (!formName.trim()) {
      alert('Veuillez entrer un nom pour cette méthode de paiement')
      return
    }

    const method: PaymentMethod = {
      id: editingId || Date.now().toString(),
      type: formType,
      name: formName,
      isDefault: methods.length === 0, // First one is default
      details: {},
    }

    if (formType === 'VIREMENT') {
      if (!formIban || !formBic || !formAccountHolder) {
        alert('Veuillez remplir tous les champs du virement bancaire')
        return
      }
      method.details = {
        bankName: formBankName,
        iban: formIban,
        bic: formBic,
        accountHolder: formAccountHolder,
      }
    } else if (formType === 'PAYPAL') {
      if (!formIdentifier) {
        alert('Veuillez entrer votre email PayPal')
        return
      }
      method.details = { identifier: formIdentifier }
    } else if (formType === 'REVOLUT') {
      if (!formIdentifier) {
        alert('Veuillez entrer votre Revtag')
        return
      }
      method.details = { identifier: formIdentifier }
    } else if (formType === 'STRIPE') {
      if (!formPaymentLink) {
        alert('Veuillez entrer votre lien de paiement Stripe')
        return
      }
      method.details = { paymentLink: formPaymentLink }
    }

    saveMethod(method)
  }

  const getIcon = (type: PaymentMethodType) => {
    switch (type) {
      case 'VIREMENT':
        return <Building className="h-5 w-5" />
      case 'PAYPAL':
        return <CreditCard className="h-5 w-5" />
      case 'REVOLUT':
        return <Repeat className="h-5 w-5" />
      case 'STRIPE':
        return <DollarSign className="h-5 w-5" />
    }
  }

  const getColor = (type: PaymentMethodType) => {
    switch (type) {
      case 'VIREMENT':
        return 'blue'
      case 'PAYPAL':
        return 'indigo'
      case 'REVOLUT':
        return 'purple'
      case 'STRIPE':
        return 'emerald'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-xl bg-slate-900 shadow-2xl ring-1 ring-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-6 flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-white">Moyens de Paiement</h2>
            <p className="mt-1 text-sm text-slate-400">
              Gérez vos méthodes de paiement pour accélérer la création de factures
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {/* Add New Button */}
          {!isAdding && (
            <button
              onClick={() => setIsAdding(true)}
              className="mb-6 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-700 bg-slate-800/50 px-4 py-4 text-sm font-semibold text-slate-300 transition-all hover:border-slate-600 hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              Ajouter un moyen de paiement
            </button>
          )}

          {/* Add/Edit Form */}
          {isAdding && (
            <div className="mb-6 rounded-xl border border-slate-800 bg-slate-800/50 p-6">
              <h3 className="mb-4 text-lg font-bold text-white">
                {editingId ? 'Modifier' : 'Nouveau'} moyen de paiement
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-400">
                    Nom du moyen de paiement
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ex: Compte Pro BNP, PayPal Perso..."
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                    required
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-400">Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['VIREMENT', 'PAYPAL', 'REVOLUT', 'STRIPE'] as PaymentMethodType[]).map(
                      (type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setFormType(type)}
                          className={cn(
                            'flex items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all',
                            formType === type
                              ? `border-${getColor(type)}-500 bg-${getColor(type)}-500/10 text-${getColor(type)}-400`
                              : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600'
                          )}
                        >
                          {getIcon(type)}
                          {type}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Dynamic Fields */}
                {formType === 'VIREMENT' && (
                  <>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-400">
                        Nom de la banque (optionnel)
                      </label>
                      <input
                        type="text"
                        value={formBankName}
                        onChange={(e) => setFormBankName(e.target.value)}
                        placeholder="Ex: BNP Paribas"
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-400">IBAN</label>
                      <input
                        type="text"
                        value={formIban}
                        onChange={(e) => setFormIban(e.target.value)}
                        placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-400">BIC</label>
                      <input
                        type="text"
                        value={formBic}
                        onChange={(e) => setFormBic(e.target.value)}
                        placeholder="BNPAFRPPXXX"
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-400">
                        Titulaire du compte
                      </label>
                      <input
                        type="text"
                        value={formAccountHolder}
                        onChange={(e) => setFormAccountHolder(e.target.value)}
                        placeholder="Nom complet"
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                        required
                      />
                    </div>
                  </>
                )}

                {formType === 'PAYPAL' && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-400">
                      Email PayPal
                    </label>
                    <input
                      type="email"
                      value={formIdentifier}
                      onChange={(e) => setFormIdentifier(e.target.value)}
                      placeholder="email@example.com"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                      required
                    />
                  </div>
                )}

                {formType === 'REVOLUT' && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-400">Revtag</label>
                    <input
                      type="text"
                      value={formIdentifier}
                      onChange={(e) => setFormIdentifier(e.target.value)}
                      placeholder="@username"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                      required
                    />
                  </div>
                )}

                {formType === 'STRIPE' && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-400">
                      Lien de paiement Stripe
                    </label>
                    <input
                      type="url"
                      value={formPaymentLink}
                      onChange={(e) => setFormPaymentLink(e.target.value)}
                      placeholder="https://buy.stripe.com/..."
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                      required
                    />
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-800"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-lg bg-purple-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-purple-600"
                  >
                    {editingId ? 'Enregistrer' : 'Ajouter'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* List of Methods */}
          {methods.length === 0 && !isAdding ? (
            <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-12 text-center">
              <CreditCard className="mx-auto mb-4 h-12 w-12 text-slate-600" />
              <p className="text-lg font-semibold text-slate-400">Aucun moyen de paiement</p>
              <p className="mt-2 text-sm text-slate-500">
                Ajoutez vos moyens de paiement pour accélérer la création de factures
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {methods.map((method) => {
                const color = getColor(method.type)
                return (
                  <div
                    key={method.id}
                    className="group relative rounded-lg border border-slate-800 bg-slate-800/30 p-4 transition-all hover:border-slate-700 hover:bg-slate-800/50"
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={cn(
                          'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full',
                          `bg-${color}-500/20 text-${color}-400`
                        )}
                      >
                        {getIcon(method.type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-white">{method.name}</h4>
                          {method.isDefault && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-semibold text-purple-400">
                              <Check className="h-3 w-3" />
                              Par défaut
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-slate-400">{method.type}</p>

                        {/* Details */}
                        <div className="mt-2 space-y-1 text-xs text-slate-500">
                          {method.type === 'VIREMENT' && (
                            <>
                              {method.details.bankName && <p>Banque: {method.details.bankName}</p>}
                              <p>IBAN: {method.details.iban}</p>
                              <p>BIC: {method.details.bic}</p>
                              <p>Titulaire: {method.details.accountHolder}</p>
                            </>
                          )}
                          {method.type === 'PAYPAL' && <p>Email: {method.details.identifier}</p>}
                          {method.type === 'REVOLUT' && <p>Revtag: {method.details.identifier}</p>}
                          {method.type === 'STRIPE' && (
                            <p className="truncate">Lien: {method.details.paymentLink}</p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                        {!method.isDefault && (
                          <button
                            onClick={() => setDefault(method.id)}
                            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-purple-400"
                            title="Définir par défaut"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(method)}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-blue-400"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Êtes-vous sûr de vouloir supprimer ce moyen de paiement ?')) {
                              deleteMethod(method.id)
                            }
                          }}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
