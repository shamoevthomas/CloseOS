import { useState, useRef, useEffect } from 'react'
import { X, ChevronLeft, Download } from 'lucide-react'
import type { Offer } from './OfferDetailModal'
import type { Prospect } from '../contexts/ProspectsContext'
import { useInternalContacts } from '../contexts/InternalContactsContext'
import type { PaymentMethod as SavedPaymentMethod } from './PaymentMethodsModal'
import type { IssuerProfile } from './IssuerProfilesModal'
// @ts-ignore - html2pdf.js doesn't have types
import html2pdf from 'html2pdf.js'

interface InvoiceGeneratorModalProps {
  offer: Offer
  deals: Prospect[]
  commission: number
  startDate: string
  endDate: string
  onClose: () => void
}

type PaymentMethod = 'paypal' | 'virement' | 'revolut' | 'stripe'

const STORAGE_KEY = 'closeros_payment_methods'
const ISSUER_STORAGE_KEY = 'closeros_issuer_profiles'

export function InvoiceGeneratorModal({
  offer,
  deals,
  commission,
  startDate,
  endDate,
  onClose,
}: InvoiceGeneratorModalProps) {
  const { contacts } = useInternalContacts()
  const invoiceRef = useRef<HTMLDivElement>(null)

  // Saved payment methods
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([])
  const [selectedMethodId, setSelectedMethodId] = useState<string>('custom')

  // Saved issuer profiles
  const [savedProfiles, setSavedProfiles] = useState<IssuerProfile[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<string>('custom')

  // Issuer profile fields
  const [issuerName, setIssuerName] = useState('')
  const [issuerCompanyName, setIssuerCompanyName] = useState('')
  const [issuerAddress, setIssuerAddress] = useState('')
  const [issuerCity, setIssuerCity] = useState('')
  const [issuerZip, setIssuerZip] = useState('')
  const [issuerCountry, setIssuerCountry] = useState('France')
  const [issuerSiret, setIssuerSiret] = useState('')
  const [issuerEmail, setIssuerEmail] = useState('')
  const [issuerPhone, setIssuerPhone] = useState('')

  // Step 1: Configuration
  const [step, setStep] = useState<1 | 2>(1)
  const [tvaApplicable, setTvaApplicable] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('virement')

  // Payment method fields
  const [paypalEmail, setPaypalEmail] = useState('')
  const [iban, setIban] = useState('')
  const [bic, setBic] = useState('')
  const [accountHolder, setAccountHolder] = useState('')
  const [revtag, setRevtag] = useState('')
  const [stripeLink, setStripeLink] = useState('')

  // Invoice metadata
  const [invoiceNumber, setInvoiceNumber] = useState(
    `FAC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`
  )

  // Load saved payment methods
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const methods: SavedPaymentMethod[] = JSON.parse(saved)
      setSavedMethods(methods)

      // Auto-select default method if exists
      const defaultMethod = methods.find(m => m.isDefault)
      if (defaultMethod) {
        setSelectedMethodId(defaultMethod.id)
        applyPaymentMethod(defaultMethod)
      }
    }
  }, [])

  // Load saved issuer profiles
  useEffect(() => {
    const saved = localStorage.getItem(ISSUER_STORAGE_KEY)
    if (saved) {
      const profiles: IssuerProfile[] = JSON.parse(saved)
      setSavedProfiles(profiles)

      // Auto-select default profile if exists
      const defaultProfile = profiles.find(p => p.isDefault)
      if (defaultProfile) {
        setSelectedProfileId(defaultProfile.id)
        applyIssuerProfile(defaultProfile)
      }
    }
  }, [])

  // Apply issuer profile details
  const applyIssuerProfile = (profile: IssuerProfile) => {
    setIssuerName(profile.name)
    setIssuerCompanyName(profile.companyName)
    setIssuerAddress(profile.address)
    setIssuerCity(profile.city)
    setIssuerZip(profile.zip)
    setIssuerCountry(profile.country)
    setIssuerSiret(profile.siret)
    setIssuerEmail(profile.email)
    setIssuerPhone(profile.phone)
  }

  // Handle issuer profile selection
  const handleProfileSelect = (profileId: string) => {
    setSelectedProfileId(profileId)
    if (profileId === 'custom') {
      // Reset to empty/custom
      setIssuerName('')
      setIssuerCompanyName('')
      setIssuerAddress('')
      setIssuerCity('')
      setIssuerZip('')
      setIssuerCountry('France')
      setIssuerSiret('')
      setIssuerEmail('')
      setIssuerPhone('')
    } else {
      const profile = savedProfiles.find(p => p.id === profileId)
      if (profile) {
        applyIssuerProfile(profile)
      }
    }
  }

  // Apply payment method details
  const applyPaymentMethod = (method: SavedPaymentMethod) => {
    // Map PaymentMethodType to PaymentMethod
    const typeMap: Record<string, PaymentMethod> = {
      'VIREMENT': 'virement',
      'PAYPAL': 'paypal',
      'REVOLUT': 'revolut',
      'STRIPE': 'stripe'
    }
    setPaymentMethod(typeMap[method.type])

    if (method.type === 'VIREMENT') {
      setIban(method.details.iban || '')
      setBic(method.details.bic || '')
      setAccountHolder(method.details.accountHolder || '')
    } else if (method.type === 'PAYPAL') {
      setPaypalEmail(method.details.identifier || '')
    } else if (method.type === 'REVOLUT') {
      setRevtag(method.details.identifier || '')
    } else if (method.type === 'STRIPE') {
      setStripeLink(method.details.paymentLink || '')
    }
  }

  // Handle saved method selection
  const handleMethodSelect = (methodId: string) => {
    setSelectedMethodId(methodId)
    if (methodId === 'custom') {
      // Reset to empty/custom
      setPaymentMethod('virement')
      setIban('')
      setBic('')
      setAccountHolder('')
      setPaypalEmail('')
      setRevtag('')
      setStripeLink('')
    } else {
      const method = savedMethods.find(m => m.id === methodId)
      if (method) {
        applyPaymentMethod(method)
      }
    }
  }

  // Find billing contact for this offer
  const billingContact = contacts.find(
    (c) => c.linkedOfferId === offer.id.toString() && c.isBillingContact
  )

  // Calculate TVA if applicable
  const tvaRate = 0.2 // 20% TVA
  const commissionHT = commission
  const tvaAmount = tvaApplicable ? commissionHT * tvaRate : 0
  const totalTTC = commissionHT + tvaAmount

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  const handlePreview = () => {
    // Validate fields based on payment method
    if (paymentMethod === 'paypal' && !paypalEmail) {
      alert('Veuillez renseigner votre email PayPal')
      return
    }
    if (paymentMethod === 'virement' && (!iban || !bic || !accountHolder)) {
      alert('Veuillez renseigner tous les champs du virement bancaire')
      return
    }
    if (paymentMethod === 'revolut' && !revtag) {
      alert('Veuillez renseigner votre Revtag')
      return
    }
    if (paymentMethod === 'stripe' && !stripeLink) {
      alert('Veuillez renseigner votre lien de paiement Stripe')
      return
    }

    setStep(2)
  }

  const handleExportPDF = () => {
    // Use html2pdf.js for perfect PDF export - NO BROWSER PRINT
    const element = document.getElementById('invoice-preview-content')

    if (!element) {
      alert('Erreur lors de la génération du PDF')
      return
    }

    // Options for perfect rendering
    const opt = {
      margin: 0, // No margins - padding is in the element itself
      filename: `Facture-${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: true, // Enable logging for debugging
        backgroundColor: '#ffffff' // Force white background
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      }
    }

    // Generate and download PDF directly - bypasses browser print dialog
    html2pdf().set(opt).from(element).save()
  }

  const getPaymentMethodLabel = () => {
    const labels = {
      paypal: 'PayPal',
      virement: 'Virement Bancaire',
      revolut: 'Revolut',
      stripe: 'Stripe',
    }
    return labels[paymentMethod]
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 shadow-2xl ring-1 ring-slate-800">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Step 1: Configuration */}
        {step === 1 && (
          <div className="p-8">
            <h2 className="mb-6 text-2xl font-bold text-white">Configuration de la Facture</h2>

            <div className="space-y-6">
              {/* Invoice Number */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-400">
                  Numéro de Facture
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                  placeholder="Ex: FAC-2025-001234"
                />
              </div>

              {/* Saved Issuer Profiles */}
              {savedProfiles.length > 0 && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-400">
                    Profil Émetteur Enregistré
                  </label>
                  <select
                    value={selectedProfileId}
                    onChange={(e) => handleProfileSelect(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                  >
                    <option value="custom">Saisie manuelle...</option>
                    {savedProfiles.map(profile => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name} - {profile.companyName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Manual Issuer Fields (shown only for custom) */}
              {selectedProfileId === 'custom' && (
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-400">
                      Nom / Raison Sociale de l'Émetteur
                    </label>
                    <input
                      type="text"
                      value={issuerCompanyName}
                      onChange={(e) => setIssuerCompanyName(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                      placeholder="Ex: ACME SARL, Jean Dupont EI..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-400">
                        Adresse
                      </label>
                      <input
                        type="text"
                        value={issuerAddress}
                        onChange={(e) => setIssuerAddress(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                        placeholder="Ex: 123 Rue de la Paix"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-400">
                        Ville
                      </label>
                      <input
                        type="text"
                        value={issuerCity}
                        onChange={(e) => setIssuerCity(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                        placeholder="Paris"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-400">
                        Code Postal
                      </label>
                      <input
                        type="text"
                        value={issuerZip}
                        onChange={(e) => setIssuerZip(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                        placeholder="75001"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-400">
                        Pays
                      </label>
                      <input
                        type="text"
                        value={issuerCountry}
                        onChange={(e) => setIssuerCountry(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                        placeholder="France"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-400">
                        SIRET
                      </label>
                      <input
                        type="text"
                        value={issuerSiret}
                        onChange={(e) => setIssuerSiret(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                        placeholder="123 456 789 00012"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-400">
                        Email
                      </label>
                      <input
                        type="email"
                        value={issuerEmail}
                        onChange={(e) => setIssuerEmail(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                        placeholder="contact@entreprise.com"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-400">
                        Téléphone
                      </label>
                      <input
                        type="tel"
                        value={issuerPhone}
                        onChange={(e) => setIssuerPhone(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                        placeholder="+33 1 23 45 67 89"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TVA Toggle */}
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={tvaApplicable}
                      onChange={(e) => setTvaApplicable(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="h-6 w-11 rounded-full bg-slate-700 peer-checked:bg-purple-500"></div>
                    <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5"></div>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-white">TVA Applicable ?</div>
                    <div className="mt-1 text-xs text-slate-400">
                      Ajouter 20% de TVA au montant de la commission
                    </div>
                  </div>
                </label>
              </div>

              {/* Saved Payment Methods */}
              {savedMethods.length > 0 && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-400">
                    Moyen de Paiement Enregistré
                  </label>
                  <select
                    value={selectedMethodId}
                    onChange={(e) => handleMethodSelect(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                  >
                    <option value="custom">Saisie manuelle...</option>
                    {savedMethods.map(method => (
                      <option key={method.id} value={method.id}>
                        {method.name} ({method.type})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Payment Method Type (shown only for custom) */}
              {selectedMethodId === 'custom' && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-400">
                    Type de Paiement
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                  >
                    <option value="virement">Virement Bancaire</option>
                    <option value="paypal">PayPal</option>
                    <option value="revolut">Revolut</option>
                    <option value="stripe">Stripe Link</option>
                  </select>
                </div>
              )}

              {/* Dynamic Payment Fields */}
              {paymentMethod === 'paypal' && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-400">
                    Email PayPal
                  </label>
                  <input
                    type="email"
                    value={paypalEmail}
                    onChange={(e) => setPaypalEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                    placeholder="votre@email.com"
                  />
                </div>
              )}

              {paymentMethod === 'virement' && (
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-400">IBAN</label>
                    <input
                      type="text"
                      value={iban}
                      onChange={(e) => setIban(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                      placeholder="FR76 1234 5678 9012 3456 7890 123"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-400">BIC</label>
                    <input
                      type="text"
                      value={bic}
                      onChange={(e) => setBic(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                      placeholder="BNPAFRPPXXX"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-400">
                      Titulaire du Compte
                    </label>
                    <input
                      type="text"
                      value={accountHolder}
                      onChange={(e) => setAccountHolder(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                      placeholder="Nom du titulaire"
                    />
                  </div>
                </div>
              )}

              {paymentMethod === 'revolut' && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-400">
                    Revtag (@...)
                  </label>
                  <input
                    type="text"
                    value={revtag}
                    onChange={(e) => setRevtag(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                    placeholder="@votrenom"
                  />
                </div>
              )}

              {paymentMethod === 'stripe' && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-400">
                    Lien de Paiement Stripe
                  </label>
                  <input
                    type="url"
                    value={stripeLink}
                    onChange={(e) => setStripeLink(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                    placeholder="https://buy.stripe.com/..."
                  />
                </div>
              )}

              {/* Preview Button */}
              <button
                onClick={handlePreview}
                className="w-full rounded-lg bg-purple-500 px-6 py-3 font-semibold text-white transition-all hover:bg-purple-600"
              >
                Prévisualiser
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 2 && (
          <div className="p-8">
            {/* Actions */}
            <div className="mb-6 flex items-center justify-between">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-700"
              >
                <ChevronLeft className="h-4 w-4" />
                Modifier
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 rounded-lg bg-purple-500 px-6 py-2 font-semibold text-white transition-all hover:bg-purple-600"
              >
                <Download className="h-4 w-4" />
                Exporter PDF
              </button>
            </div>

            {/* Invoice Preview (A4 ratio) */}
            <div className="rounded-lg border border-slate-700 bg-white p-8 shadow-2xl">
              <div
                id="invoice-preview-content"
                ref={invoiceRef}
                className="mx-auto space-y-8"
                style={{
                  backgroundColor: 'white',
                  color: 'black',
                  width: '210mm',
                  minHeight: '297mm',
                  padding: '20mm',
                  boxSizing: 'border-box'
                }}
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <h1 className="text-4xl font-bold text-slate-900">FACTURE</h1>
                  <div className="text-right">
                    <p className="text-sm text-slate-600">
                      {new Date().toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>

                {/* Invoice Number */}
                <div className="text-sm text-slate-700">
                  <p>
                    <span className="font-semibold">Numéro de facture:</span> {invoiceNumber}
                  </p>
                </div>

                {/* Identity Grid - 2 Columns */}
                <div className="grid grid-cols-2 gap-8">
                  {/* Émetteur (Left) */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Émetteur
                    </p>
                    <div className="space-y-1 text-sm text-slate-900">
                      <p className="font-bold">{issuerCompanyName || issuerName || 'Émetteur'}</p>
                      {(issuerAddress || issuerCity || issuerZip || issuerCountry) && (
                        <p className="text-slate-700">
                          {issuerAddress && <span>{issuerAddress}<br /></span>}
                          {(issuerCity || issuerZip) && (
                            <span>
                              {issuerZip && `${issuerZip} `}
                              {issuerCity}
                              <br />
                            </span>
                          )}
                          {issuerCountry && <span>{issuerCountry}</span>}
                        </p>
                      )}
                      {issuerSiret && (
                        <p className="text-slate-700">
                          <span className="font-medium">SIRET:</span> {issuerSiret}
                        </p>
                      )}
                      {issuerEmail && (
                        <p className="text-slate-700">
                          <span className="font-medium">Email:</span> {issuerEmail}
                        </p>
                      )}
                      {issuerPhone && (
                        <p className="text-slate-700">
                          <span className="font-medium">Tél:</span> {issuerPhone}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Destinataire (Right) */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Destinataire
                    </p>
                    <div className="space-y-1 text-sm text-slate-900">
                      <p className="font-bold">{offer.company}</p>
                      <p className="text-slate-700">{offer.name}</p>
                      {/* Find billing contact for this offer */}
                      {billingContact && (
                        <>
                          <p className="mt-2 text-slate-700">
                            <span className="font-medium">Contact:</span> {billingContact.name}
                          </p>
                          {billingContact.billingAddress && (
                            <p className="text-slate-700 whitespace-pre-line">
                              {billingContact.billingAddress}
                            </p>
                          )}
                          {billingContact.siret && (
                            <p className="text-slate-700">
                              <span className="font-medium">SIRET:</span> {billingContact.siret}
                            </p>
                          )}
                          {billingContact.email && (
                            <p className="text-slate-700">
                              <span className="font-medium">Email:</span> {billingContact.email}
                            </p>
                          )}
                          {billingContact.phone && (
                            <p className="text-slate-700">
                              <span className="font-medium">Tél:</span> {billingContact.phone}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Period */}
                <div className="border-t border-slate-200 pt-4">
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold">Période:</span>{' '}
                    {new Date(startDate).toLocaleDateString('fr-FR')} au{' '}
                    {new Date(endDate).toLocaleDateString('fr-FR')}
                  </p>
                </div>

                {/* Line Items Table - French Standard */}
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-800 bg-slate-50">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                        Description
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">
                        Qté
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">
                        Prix Unitaire
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">
                        Total HT
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="px-4 py-4 text-sm text-slate-900">
                        <p className="font-medium">Commissions sur ventes - {offer.name}</p>
                        <p className="mt-1 text-xs text-slate-600">
                          Période: {new Date(startDate).toLocaleDateString('fr-FR')} au{' '}
                          {new Date(endDate).toLocaleDateString('fr-FR')}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          {deals.length} vente(s) réalisée(s)
                        </p>
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-slate-900">1</td>
                      <td className="px-4 py-4 text-right text-sm text-slate-900">
                        {formatCurrency(commissionHT)}
                      </td>
                      <td className="px-4 py-4 text-right text-sm font-semibold text-slate-900">
                        {formatCurrency(commissionHT)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Totals Section */}
                <div className="flex justify-end">
                  <div className="w-80 space-y-2">
                    <div className="flex justify-between border-b border-slate-200 pb-2 text-sm">
                      <span className="text-slate-700">Total HT</span>
                      <span className="font-semibold text-slate-900">
                        {formatCurrency(commissionHT)}
                      </span>
                    </div>
                    {tvaApplicable && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-700">TVA (20%)</span>
                        <span className="font-semibold text-slate-900">
                          {formatCurrency(tvaAmount)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-t-2 border-slate-800 pt-2 text-lg">
                      <span className="font-bold text-slate-900">
                        Total {tvaApplicable ? 'TTC' : ''}
                      </span>
                      <span className="font-bold text-slate-900">{formatCurrency(totalTTC)}</span>
                    </div>
                  </div>
                </div>

                {/* Footer - Payment & Legal */}
                <div className="grid grid-cols-2 gap-8 border-t border-slate-200 pt-6">
                  {/* Left - Payment Info */}
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-slate-900">Conditions de règlement</p>
                    <div className="space-y-2 text-sm text-slate-700">
                      <p>
                        <span className="font-medium">Échéance:</span> À réception
                      </p>
                      <p>
                        <span className="font-medium">Mode de règlement:</span>{' '}
                        {getPaymentMethodLabel()}
                      </p>

                      {/* Conditional RIB for Virement */}
                      {paymentMethod === 'virement' && (
                        <div className="mt-3 rounded border border-slate-300 bg-slate-50 p-3">
                          <p className="mb-2 text-xs font-semibold uppercase text-slate-600">
                            Coordonnées bancaires
                          </p>
                          <div className="space-y-1 text-xs">
                            <p>
                              <span className="font-medium">IBAN:</span> {iban}
                            </p>
                            <p>
                              <span className="font-medium">BIC:</span> {bic}
                            </p>
                            <p>
                              <span className="font-medium">Titulaire:</span> {accountHolder}
                            </p>
                          </div>
                        </div>
                      )}

                      {paymentMethod === 'paypal' && (
                        <p>
                          <span className="font-medium">PayPal:</span> {paypalEmail}
                        </p>
                      )}

                      {paymentMethod === 'revolut' && (
                        <p>
                          <span className="font-medium">Revolut:</span> {revtag}
                        </p>
                      )}

                      {paymentMethod === 'stripe' && (
                        <p className="break-all">
                          <span className="font-medium">Lien Stripe:</span>{' '}
                          <a href={stripeLink} className="text-blue-600 underline">
                            {stripeLink}
                          </a>
                        </p>
                      )}
                    </div>

                    {/* CRITICAL - VAT Exemption */}
                    {!tvaApplicable && (
                      <div className="mt-4 rounded border-l-4 border-purple-500 bg-purple-50 p-3">
                        <p className="text-xs font-semibold italic text-slate-800">
                          TVA non applicable, art. 293 B du CGI
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right - Additional Info */}
                  <div className="space-y-2 text-xs text-slate-600">
                    <p className="font-semibold text-slate-700">Informations complémentaires</p>
                    <p>En cas de retard de paiement, des pénalités pourront être appliquées.</p>
                    <p className="mt-4 text-slate-500">
                      Facture générée automatiquement par CloserOS
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
