import { useState, useEffect } from 'react'
import { X, Plus, Pencil, Trash2, CreditCard, Building, Repeat, DollarSign, Check, Loader2, Star } from 'lucide-react'
import { cn } from '../lib/utils'
import { supabase } from '../lib/supabase'

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

interface PaymentMethodsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function PaymentMethodsModal({ isOpen, onClose }: PaymentMethodsModalProps) {
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
    setIsLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

      if (error) throw error

      if (data) {
        const mapped = data.map(m => ({
          id: m.id,
          type: m.type,
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
  }, [isOpen])

  const saveMethod = async (method: PaymentMethod) => {
    setIsLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert("Session expirée")
        return
      }

      const dbData = {
        user_id: user.id,
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
      alert("Erreur lors de la sauvegarde")
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
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await supabase.from('payment_methods').update({ is_default: false }).eq('user_id', user.id)
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

  const getColor = (type: PaymentMethodType) => {
    switch (type) {
      case 'VIREMENT': return 'blue'
      case 'PAYPAL': return 'indigo'
      case 'REVOLUT': return 'purple'
      case 'STRIPE': return 'emerald'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-xl bg-slate-900 shadow-2xl ring-1 ring-slate-800" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-800 p-6 flex-shrink-0">
          <div><h2 className="text-2xl font-bold text-white">Moyens de Paiement</h2></div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {!isAdding && (
            <button onClick={() => setIsAdding(true)} className="mb-6 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-700 bg-slate-800/50 px-4 py-4 text-sm font-semibold text-slate-300 hover:bg-slate-800">
              <Plus className="h-4 w-4" /> Ajouter un moyen de paiement
            </button>
          )}

          {isAdding && (
            <div className="mb-6 rounded-xl border border-slate-800 bg-slate-800/50 p-6 animate-in fade-in slide-in-from-bottom-2">
              <h3 className="mb-4 text-lg font-bold text-white">{editingId ? 'Modifier' : 'Nouveau'} moyen de paiement</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="mb-2 block text-sm font-medium text-slate-400">Nom</label><input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full bg-slate-900 border-slate-700 rounded-lg p-2 text-white" required /></div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-400">Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['VIREMENT', 'PAYPAL', 'REVOLUT', 'STRIPE'] as PaymentMethodType[]).map(type => (
                      <button key={type} type="button" onClick={() => setFormType(type)} className={cn('flex items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all', formType === type ? `border-${getColor(type)}-500 bg-${getColor(type)}-500/10 text-${getColor(type)}-400` : 'border-slate-700 bg-slate-800/50 text-slate-300')}>{getIcon(type)}{type}</button>
                    ))}
                  </div>
                </div>

                {formType === 'VIREMENT' && (
                  <div className="space-y-3 p-4 bg-slate-950 rounded-lg border border-slate-800">
                    <input type="text" placeholder="Banque" value={formBankName} onChange={e => setFormBankName(e.target.value)} className="w-full bg-slate-900 border-slate-700 rounded-lg p-2 text-white" />
                    <input type="text" placeholder="IBAN" value={formIban} onChange={e => setFormIban(e.target.value)} className="w-full bg-slate-900 border-slate-700 rounded-lg p-2 text-white" required />
                    <input type="text" placeholder="BIC" value={formBic} onChange={e => setFormBic(e.target.value)} className="w-full bg-slate-900 border-slate-700 rounded-lg p-2 text-white" required />
                    <input type="text" placeholder="Titulaire" value={formAccountHolder} onChange={e => setFormAccountHolder(e.target.value)} className="w-full bg-slate-900 border-slate-700 rounded-lg p-2 text-white" required />
                  </div>
                )}
                {(formType === 'PAYPAL' || formType === 'REVOLUT') && <input type="text" placeholder={formType === 'PAYPAL' ? "Email" : "Revtag"} value={formIdentifier} onChange={e => setFormIdentifier(e.target.value)} className="w-full bg-slate-900 border-slate-700 rounded-lg p-2 text-white" required />}
                {formType === 'STRIPE' && <input type="text" placeholder="Lien Stripe" value={formPaymentLink} onChange={e => setFormPaymentLink(e.target.value)} className="w-full bg-slate-900 border-slate-700 rounded-lg p-2 text-white" required />}

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={resetForm} className="flex-1 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800">Annuler</button>
                  <button type="submit" disabled={isLoading} className="flex-1 rounded-lg bg-purple-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-600 flex justify-center items-center">
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (editingId ? 'Enregistrer' : 'Ajouter')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {methods.length === 0 && !isAdding ? (
            <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-12 text-center">
              <CreditCard className="mx-auto mb-4 h-12 w-12 text-slate-600" />
              <p className="text-slate-400">Aucun moyen de paiement.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {methods.map((method) => (
                <div key={method.id} className="group relative rounded-lg border border-slate-800 bg-slate-800/30 p-4 transition-all hover:bg-slate-800/50">
                  <div className="flex items-start gap-4">
                    <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full', `bg-${getColor(method.type)}-500/20 text-${getColor(method.type)}-400`)}>{getIcon(method.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-white">{method.name}</h4>
                        {method.isDefault && <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-semibold text-purple-400"><Check className="h-3 w-3" /> Défaut</span>}
                      </div>
                      <p className="mt-1 text-sm text-slate-400">{method.type}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!method.isDefault && <button onClick={() => setDefault(method.id)} className="p-2 text-slate-400 hover:text-yellow-400"><Star className="h-4 w-4" /></button>}
                      <button onClick={() => handleEdit(method)} className="p-2 text-slate-400 hover:text-blue-400"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => confirm('Supprimer ?') && deleteMethod(method.id)} className="p-2 text-slate-400 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
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