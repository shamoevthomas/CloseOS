import { useState, useRef, useEffect, useMemo } from 'react'
import { X, ChevronLeft, Download, Loader2 } from 'lucide-react' // 👈 AJOUT Loader2
import type { Offer } from './OfferDetailModal'
import type { Prospect } from '../contexts/ProspectsContext'
import type { PaymentMethod as SavedPaymentMethod } from './PaymentMethodsModal'
import type { IssuerProfile } from './IssuerProfilesModal'
import { supabase } from '../lib/supabase'
// @ts-ignore - html2pdf.js doesn't have types
import html2pdf from 'html2pdf.js'
import QRCode from 'qrcode' // 👈 AJOUT QRCode

interface InvoiceGeneratorModalProps {
  offer: Offer
  deals: Prospect[]
  commission: number
  startDate: string
  endDate: string
  onClose: () => void
}

type PaymentMethod = 'paypal' | 'virement' | 'revolut' | 'stripe'

export function InvoiceGeneratorModal({
  offer,
  deals,
  commission,
  startDate,
  endDate,
  onClose,
}: InvoiceGeneratorModalProps) {
  const invoiceRef = useRef<HTMLDivElement>(null)

  // Saved payment methods & profiles (fetched from DB)
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([])
  const [savedProfiles, setSavedProfiles] = useState<IssuerProfile[]>([])
  
  // Selection states
  const [selectedMethodId, setSelectedMethodId] = useState<string>('custom')
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

  // --- AJOUT : ÉTATS STRIPE CONNECT ---
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null)
  const [useStripePayment, setUseStripePayment] = useState(true)
  const [isGeneratingLink, setIsGeneratingLink] = useState(false)
  const [generatedLink, setGeneratedLink] = useState('')
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  // ------------------------------------

  // Invoice metadata
  const [invoiceNumber, setInvoiceNumber] = useState(
    `FAC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`
  )

  // --- AJOUT : VÉRIFICATION DU STATUT STRIPE ---
  useEffect(() => {
    const checkStripe = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('stripe_account_id, stripe_connected')
          .eq('id', user.id)
          .single()
        
        if (data?.stripe_connected && data?.stripe_account_id) {
          setStripeAccountId(data.stripe_account_id)
          setUseStripePayment(true) // Activé par défaut si connecté
        } else {
          setUseStripePayment(false)
        }
      }
    }
    checkStripe()
  }, [])
  // ---------------------------------------------

  // --- 1. CHARGEMENT DES PROFILS ÉMETTEURS DEPUIS SUPABASE ---
  useEffect(() => {
    const loadProfiles = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase
          .from('issuer_profiles')
          .select('*')
          .eq('user_id', user.id)
          .order('is_default', { ascending: false }) // Les défauts en premier

        if (error) throw error

        if (data) {
          const mappedProfiles: IssuerProfile[] = data.map(p => ({
            id: p.id,
            name: p.name,
            companyName: p.company_name,
            address: p.address || '',
            city: p.city || '',
            zip: p.zip || '',
            country: p.country || 'France',
            siret: p.siret || '',
            email: p.email || '',
            phone: p.phone || '',
            isDefault: p.is_default
          }))
          
          setSavedProfiles(mappedProfiles)

          // Appliquer le profil par défaut s'il existe
          const defaultProfile = mappedProfiles.find(p => p.isDefault)
          if (defaultProfile) {
            setSelectedProfileId(defaultProfile.id)
            applyIssuerProfile(defaultProfile)
          }
        }
      } catch (err) {
        console.error('Erreur chargement profils:', err)
      }
    }
    loadProfiles()
  }, [])

  // --- 2. CHARGEMENT DES MOYENS DE PAIEMENT DEPUIS SUPABASE ---
  useEffect(() => {
    const loadMethods = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase
          .from('payment_methods')
          .select('*')
          .eq('user_id', user.id)
          .order('is_default', { ascending: false })

        if (error) throw error

        if (data) {
          const mappedMethods: SavedPaymentMethod[] = data.map(m => ({
            id: m.id,
            type: m.type,
            name: m.name,
            isDefault: m.is_default,
            details: m.details || {}
          }))

          setSavedMethods(mappedMethods)

          // Appliquer la méthode par défaut si elle existe
          const defaultMethod = mappedMethods.find(m => m.isDefault)
          if (defaultMethod) {
            setSelectedMethodId(defaultMethod.id)
            applyPaymentMethod(defaultMethod)
          }
        }
      } catch (err) {
        console.error('Erreur chargement méthodes:', err)
      }
    }
    loadMethods()
  }, [])

  // --- LOGIQUE DE REGROUPEMENT DES LIGNES (DÉTAIL FACTURE) ---
  const lineItems = useMemo(() => {
    const groups: Record<string, { description: string; count: number; total: number; unitPrice: number }> = {}

    deals.forEach((deal) => {
      // 1. Déterminer si c'est un paiement échelonné
      const isInstallment = deal.payment_type === 'installments' || (deal.installments && deal.installments > 1)
      
      // 2. Construire le label (Nom offre/formule + Type paiement)
      const formulaName = deal.offer || offer.name
      const paymentLabel = isInstallment 
        ? `Mensualité (Paiement en ${deal.installments}x)` 
        : 'Paiement Comptant'
      
      const key = `${formulaName}-${paymentLabel}`
      
      // 3. Calculer la part de commission pour ce deal sur la période
      const fullValue = deal.value || 0
      const amountInPeriod = isInstallment ? fullValue / (deal.installments || 1) : fullValue
      
      let rate = 0.10
      const commissionStr = String(offer.commission || '10')
      const match = commissionStr.match(/(\d+(?:\.\d+)?)/)
      if (match) rate = parseFloat(match[1]) / 100
      
      const dealCommission = amountInPeriod * rate

      // 4. Agréger les lignes identiques
      if (!groups[key]) {
        groups[key] = {
          description: `${formulaName} - ${paymentLabel}`,
          count: 0,
          total: 0,
          unitPrice: dealCommission // Prix unitaire moyen estimé pour ce groupe
        }
      }

      groups[key].count++
      groups[key].total += dealCommission
    })

    return Object.values(groups)
  }, [deals, offer])

  // Recalcul du total HT basé sur les lignes détaillées (plus précis)
  const commissionHT = lineItems.reduce((acc, item) => acc + item.total, 0)
  
  // Calculate TVA if applicable
  const tvaRate = 0.2 // 20% TVA
  const tvaAmount = tvaApplicable ? commissionHT * tvaRate : 0
  const totalTTC = commissionHT + tvaAmount

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  // --- MODIFICATION : PRÉVISUALISATION ASYNC POUR STRIPE ---
  const handlePreview = async () => {
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
    // Check Stripe Link manuel seulement si le mode Auto n'est pas utilisé
    if (paymentMethod === 'stripe' && !stripeLink && !useStripePayment) {
      alert('Veuillez renseigner votre lien de paiement Stripe')
      return
    }

    // GÉNÉRATION LIEN STRIPE AUTO (Appel Backend)
    if (useStripePayment && stripeAccountId) {
      setIsGeneratingLink(true)
      try {
        const response = await fetch('/api/create-invoice-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: totalTTC,
            currency: 'eur',
            title: `Facture ${invoiceNumber}`,
            connectedAccountId: stripeAccountId,
            clientEmail: offer.billingEmail || ''
          })
        })
        
        const data = await response.json()
        if (data.url) {
          setGeneratedLink(data.url)
          // Génération QR Code
          const qrDataUrl = await QRCode.toDataURL(data.url, { width: 150, margin: 1, color: { dark: '#0F172A', light: '#FFFFFF' } })
          setQrCodeUrl(qrDataUrl)
        } else {
          console.error("Erreur Link:", data)
          alert("Erreur lors de la création du lien Stripe. La facture sera générée sans.")
        }
      } catch (e) {
        console.error("Erreur API:", e)
        alert("Impossible de joindre le serveur de paiement.")
      } finally {
        setIsGeneratingLink(false)
      }
    }

    setStep(2)
  }
  // --------------------------------------------------------

  const handleExportPDF = async () => {
    const element = document.getElementById('invoice-preview-content')

    if (!element) {
      alert('Erreur lors de la génération du PDF')
      return
    }

    try {
      const opt = {
        margin: 0,
        filename: `${invoiceNumber}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: true,
          backgroundColor: '#ffffff'
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait'
        }
      }

      // 1. Générer le PDF en Blob
      const pdfBlob = await html2pdf().set(opt).from(element).output('blob')

      // 2. Upload sur Supabase Storage
      const fileName = `${Date.now()}-${invoiceNumber}.pdf`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('invoice')
        .upload(fileName, pdfBlob)

      if (uploadError) throw uploadError

      // 3. Récupérer l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('invoice')
        .getPublicUrl(fileName)

      // 4. Sauvegarde dans la table SQL
      const { error } = await supabase.from('invoices').insert([
        {
          invoice_number: invoiceNumber,
          offer_name: offer.name,
          client_name: offer.billingName || offer.company,
          amount_ht: commissionHT,
          amount_ttc: totalTTC,
          status: 'générée',
          pdf_url: publicUrl
        }
      ])

      if (error) throw error

      // 5. Téléchargement local
      const link = document.createElement('a')
      link.href = URL.createObjectURL(pdfBlob)
      link.download = `${invoiceNumber}.pdf`
      link.click()
      
      onClose()
      
    } catch (err) {
      console.error("Erreur lors de l'enregistrement de la facture:", err)
      alert("Une erreur est survenue lors de l'enregistrement de la facture.")
    }
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

              {/* Saved Issuer Profiles (FROM DB) */}
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

              {/* Section Moyen de Paiement */}
              <div className="space-y-4 rounded-xl border border-slate-700 bg-slate-800/30 p-5">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Download className="h-4 w-4 text-purple-400" />
                  Moyen de paiement principal
                </h3>
                
                {savedMethods.length > 0 && (
                  <select value={selectedMethodId} onChange={(e) => handleMethodSelect(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-white focus:border-purple-500">
                    <option value="custom">Saisie manuelle...</option>
                    {savedMethods.map(m => <option key={m.id} value={m.id}>{m.name} ({m.type})</option>)}
                  </select>
                )}

                {selectedMethodId === 'custom' && (
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-white focus:border-purple-500">
                    <option value="virement">Virement Bancaire</option>
                    <option value="paypal">PayPal</option>
                    <option value="revolut">Revolut</option>
                    <option value="stripe">Autre lien manuel</option>
                  </select>
                )}

                {/* Champs dynamiques selon méthode */}
                {paymentMethod === 'virement' && (
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" value={iban} onChange={(e) => setIban(e.target.value)} placeholder="IBAN" className="col-span-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
                    <input type="text" value={bic} onChange={(e) => setBic(e.target.value)} placeholder="BIC" className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
                    <input type="text" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} placeholder="Titulaire" className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
                  </div>
                )}
                {paymentMethod === 'paypal' && <input type="email" value={paypalEmail} onChange={(e) => setPaypalEmail(e.target.value)} placeholder="Email PayPal" className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />}
                {paymentMethod === 'revolut' && <input type="text" value={revtag} onChange={(e) => setRevtag(e.target.value)} placeholder="Revtag" className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />}
                {paymentMethod === 'stripe' && <input type="text" value={stripeLink} onChange={(e) => setStripeLink(e.target.value)} placeholder="Lien Stripe" className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />}
              </div>

              {/* 🚀 AJOUT : CASE À COCHER STRIPE CONNECT */}
              {stripeAccountId && (
                <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4">
                  <label className="flex cursor-pointer items-start gap-3">
                    <div className="relative mt-1">
                      <input
                        type="checkbox"
                        checked={useStripePayment}
                        onChange={(e) => setUseStripePayment(e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="h-5 w-9 rounded-full bg-slate-700 peer-checked:bg-indigo-500"></div>
                      <div className="absolute left-1 top-1 h-3 w-3 rounded-full bg-white transition-transform peer-checked:translate-x-4"></div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm font-bold text-white">
                        Service de règlement en ligne (Stripe)
                        <span className="rounded bg-indigo-500 px-1.5 py-0.5 text-[10px] uppercase text-white">Recommandé</span>
                      </div>
                      <p className="mt-1 text-xs text-indigo-200">
                        Ajoute un bouton de paiement sécurisé + QR Code sur la facture pour se faire payer par CB instantanément.
                      </p>
                    </div>
                  </label>
                </div>
              )}
              {/* -------------------------------------- */}

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

              {/* Preview Button */}
              <button
                onClick={handlePreview}
                disabled={isGeneratingLink} // AJOUT
                className="w-full rounded-lg bg-purple-500 px-6 py-3 font-semibold text-white transition-all hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {/* AJOUT LOADER */}
                {isGeneratingLink ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Génération du lien Stripe...
                  </>
                ) : (
                  'Prévisualiser la facture'
                )}
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
                className="mx-auto flex flex-col justify-between" // AJOUT FLEX COL JUSTIFY BETWEEN
                style={{
                  backgroundColor: 'white',
                  color: 'black',
                  width: '210mm',
                  minHeight: '297mm',
                  padding: '20mm',
                  boxSizing: 'border-box'
                }}
              >
                {/* --- WRAPPER CONTENU HAUT --- */}
                <div>
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
                  <div className="text-sm text-slate-700 mt-2 mb-8">
                    <p>
                      <span className="font-semibold">Numéro de facture:</span> {invoiceNumber}
                    </p>
                  </div>

                  {/* Identity Grid - 2 Columns */}
                  <div className="grid grid-cols-2 gap-8 mb-8">
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

                    {/* Destinataire (Right) - MODIFIÉ POUR UTILISER LES INFOS DE L'OFFRE */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Destinataire
                      </p>
                      <div className="space-y-1 text-sm text-slate-900">
                        {/* Raison Sociale / Nom Facturation */}
                        <p className="font-bold">{offer.billingName || offer.company}</p>
                        
                        {/* Nom de l'offre (Pour le contexte) */}
                        <p className="text-slate-700 font-medium">{offer.name}</p>

                        {/* Adresse de Facturation */}
                        {(offer.billingAddress || offer.billingZip || offer.billingCity || offer.billingCountry) && (
                          <div className="text-slate-700 mt-2">
                            {offer.billingAddress && <p className="whitespace-pre-line">{offer.billingAddress}</p>}
                            {(offer.billingZip || offer.billingCity) && (
                              <p>
                                {offer.billingZip ? `${offer.billingZip} ` : ''}
                                {offer.billingCity}
                              </p>
                            )}
                            {offer.billingCountry && <p>{offer.billingCountry}</p>}
                          </div>
                        )}

                        {/* Autres détails (SIRET, Email, Tel) */}
                        <div className="text-slate-700 mt-2 space-y-0.5">
                          {offer.siret && (
                            <p><span className="font-medium">SIRET:</span> {offer.siret}</p>
                          )}
                          {offer.billingEmail && (
                            <p><span className="font-medium">Email:</span> {offer.billingEmail}</p>
                          )}
                          {offer.billingPhone && (
                            <p><span className="font-medium">Tél:</span> {offer.billingPhone}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Period */}
                  <div className="border-t border-slate-200 pt-4 mb-8">
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold">Période:</span>{' '}
                      {new Date(startDate).toLocaleDateString('fr-FR')} au{' '}
                      {new Date(endDate).toLocaleDateString('fr-FR')}
                    </p>
                  </div>

                  {/* LIGNES DE FACTURE DÉTAILLÉES (NOUVEAU TABLEAU) */}
                  <table className="w-full border-collapse mb-8">
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
                      {/* Boucle sur les lignes regroupées */}
                      {lineItems.map((item, idx) => (
                        <tr key={idx} className="border-b border-slate-200">
                          <td className="px-4 py-4 text-sm text-slate-900">
                            <p className="font-medium">{item.description}</p>
                            <p className="mt-1 text-xs text-slate-600">Commission sur {item.count} vente(s)</p>
                          </td>
                          <td className="px-4 py-4 text-center text-sm text-slate-900">{item.count}</td>
                          <td className="px-4 py-4 text-right text-sm text-slate-900">
                            {formatCurrency(item.unitPrice / item.count)}
                          </td>
                          <td className="px-4 py-4 text-right text-sm font-semibold text-slate-900">
                            {formatCurrency(item.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Totals Section */}
                  <div className="flex justify-end mb-8">
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
                </div>

                {/* --- FOOTER (BAS DE PAGE) --- */}
                <div className="mt-auto pt-8 border-t border-slate-200">
                  <div className="flex justify-between items-end">
                    
                    {/* Left - Payment Info (Classique) */}
                    <div className="space-y-3 max-w-[50%]">
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

                        {/* Link Manuel */}
                        {paymentMethod === 'stripe' && (
                          <p className="break-all">
                            <span className="font-medium">Lien Stripe:</span>{' '}
                            <a href={stripeLink} className="text-blue-600 underline">
                              {stripeLink}
                            </a>
                          </p>
                        )}

                        {/* VAT Exemption */}
                        {!tvaApplicable && (
                          <div className="mt-4 rounded border-l-4 border-purple-500 bg-purple-50 p-3">
                            <p className="text-xs font-semibold italic text-slate-800">
                              TVA non applicable, art. 293 B du CGI
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 🚀 AJOUT : BLOC PAIEMENT EN LIGNE (Droite) */}
                    {generatedLink && qrCodeUrl && (
                      <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <div className="text-right">
                          <p className="text-xs font-bold uppercase text-slate-500 mb-1">Payer en ligne</p>
                          <p className="text-[10px] text-slate-400 mb-2 max-w-[120px]">
                            Scannez pour régler par CB instantanément
                          </p>
                          <a 
                            href={generatedLink} 
                            target="_blank" 
                            rel="noreferrer"
                            className="inline-block bg-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-indigo-700 no-underline"
                          >
                            Payer maintenant &rarr;
                          </a>
                        </div>
                        <img src={qrCodeUrl} alt="QR Code Paiement" className="w-20 h-20 mix-blend-multiply" />
                      </div>
                    )}
                    {/* ------------------------------------------- */}

                  </div>

                  {/* Mentions légales bas */}
                  <div className="mt-8 text-center">
                    <p className="text-[10px] text-slate-400">
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