import { useState, useRef, useEffect, useMemo } from 'react'
import { X, ChevronLeft, Download, Loader2, Mail } from 'lucide-react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import type { BusinessProspect } from '../contexts/BusinessProspectsContext'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'
import toast from 'react-hot-toast'
import type { IssuerProfile } from './BusinessIssuerProfilesModal'
import type { PaymentMethod as SavedPaymentMethod } from './BusinessPaymentMethodsModal'
// @ts-ignore
import html2pdf from 'html2pdf.js'
import QRCode from 'qrcode'

interface BusinessInvoiceGeneratorModalProps {
  isOpen: boolean
  onClose: () => void
  deals: BusinessProspect[]
  commission: number
  commissionRate: number
  startDate: string
  endDate: string
}

type PaymentMethodType = 'paypal' | 'virement' | 'revolut' | 'stripe'

export function BusinessInvoiceGeneratorModal({
  isOpen,
  onClose,
  deals,
  commission,
  commissionRate,
  startDate,
  endDate,
}: BusinessInvoiceGeneratorModalProps) {
  const { user, teamMember, ownerUserId, businessSettings } = useBusinessAuth()
  const effectiveUserId = ownerUserId || user?.id
  const invoiceRef = useRef<HTMLDivElement>(null)

  // Step
  const [step, setStep] = useState<1 | 2>(1)

  // Saved profiles & methods
  const [savedProfiles, setSavedProfiles] = useState<IssuerProfile[]>([])
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<string>('custom')
  const [selectedMethodId, setSelectedMethodId] = useState<string>('custom')

  // Invoice metadata
  const [invoiceNumber, setInvoiceNumber] = useState(
    `FAC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`
  )

  // Issuer fields
  const [issuerName, setIssuerName] = useState('')
  const [issuerCompanyName, setIssuerCompanyName] = useState('')
  const [issuerAddress, setIssuerAddress] = useState('')
  const [issuerCity, setIssuerCity] = useState('')
  const [issuerZip, setIssuerZip] = useState('')
  const [issuerCountry, setIssuerCountry] = useState('France')
  const [issuerSiret, setIssuerSiret] = useState('')
  const [issuerEmail, setIssuerEmail] = useState('')
  const [issuerPhone, setIssuerPhone] = useState('')

  // TVA
  const [tvaApplicable, setTvaApplicable] = useState(false)
  const tvaRate = 0.2

  // Payment method
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('virement')
  const [paypalEmail, setPaypalEmail] = useState('')
  const [iban, setIban] = useState('')
  const [bic, setBic] = useState('')
  const [accountHolder, setAccountHolder] = useState('')
  const [revtag, setRevtag] = useState('')
  const [stripeLink, setStripeLink] = useState('')

  // Stripe Connect
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null)
  const [useStripePayment, setUseStripePayment] = useState(true)
  const [isGeneratingLink, setIsGeneratingLink] = useState(false)
  const [generatedLink, setGeneratedLink] = useState('')
  const [qrCodeUrl, setQrCodeUrl] = useState('')

  // Late payment penalties
  const [latePenaltyRate, setLatePenaltyRate] = useState(15)
  const [latePenaltyFixed, setLatePenaltyFixed] = useState(40)

  // Loading states
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // ---------- AUTO-COMPUTED LINE ITEMS ----------

  const rate = commissionRate / 100

  // Closer deals: assigned_to = teamMember.id
  const closerDeals = useMemo(() =>
    deals.filter(d => d.assigned_to === teamMember?.id),
    [deals, teamMember?.id]
  )

  // Setter deals: assigned_setter = teamMember.id (but not also closer)
  const setterDeals = useMemo(() =>
    deals.filter(d => d.assigned_setter === teamMember?.id && d.assigned_to !== teamMember?.id),
    [deals, teamMember?.id]
  )

  // Group deals into line items (like Sales)
  const groupDeals = (dealList: BusinessProspect[]) => {
    const groups: Record<string, { description: string; count: number; total: number; unitPrice: number }> = {}

    dealList.forEach((deal) => {
      const isInstallment = deal.payment_type === 'installments' || (deal.installments && deal.installments > 1)
      const offerLabel = deal.offer || 'Commission'
      const paymentLabel = isInstallment
        ? `Mensualite (Paiement en ${deal.installments}x)`
        : 'Paiement Comptant'

      const key = `${offerLabel}-${paymentLabel}`

      const fullValue = deal.value || 0
      const amountInPeriod = isInstallment ? fullValue / (deal.installments || 1) : fullValue
      const dealCommission = amountInPeriod * rate

      if (!groups[key]) {
        groups[key] = {
          description: `${offerLabel} - ${paymentLabel}`,
          count: 0,
          total: 0,
          unitPrice: dealCommission,
        }
      }

      groups[key].count++
      groups[key].total += dealCommission
    })

    return Object.values(groups)
  }

  const closerLineItems = useMemo(() => groupDeals(closerDeals), [closerDeals, rate])
  const setterLineItems = useMemo(() => groupDeals(setterDeals), [setterDeals, rate])

  const commissionHT = commission
  const tvaAmount = tvaApplicable ? commissionHT * tvaRate : 0
  const totalTTC = commissionHT + tvaAmount

  // Receiver from businessSettings
  const receiverInfo = useMemo(() => ({
    name: businessSettings?.company_name || '',
    company: businessSettings?.raison_sociale || businessSettings?.company_name || '',
    billingAddress: businessSettings?.billing_address || '',
    billingZip: businessSettings?.billing_zip || '',
    billingCity: businessSettings?.billing_city || '',
    billingCountry: businessSettings?.billing_country || '',
    siret: businessSettings?.siret || '',
    tva: businessSettings?.tva_number || '',
  }), [businessSettings])

  // Format currency
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)

  // ---------- DATA LOADING ----------

  // Load issuer profiles
  useEffect(() => {
    if (!effectiveUserId) return
    const loadProfiles = async () => {
      try {
        const { data, error } = await supabase
          .from('issuer_profiles')
          .select('*')
          .eq('user_id', effectiveUserId)
          .order('is_default', { ascending: false })

        if (error) throw error
        if (data) {
          const mapped: IssuerProfile[] = data.map(p => ({
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
            isDefault: p.is_default,
          }))
          setSavedProfiles(mapped)

          const defaultProfile = mapped.find(p => p.isDefault)
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
  }, [effectiveUserId])

  // Load payment methods
  useEffect(() => {
    if (!effectiveUserId) return
    const loadMethods = async () => {
      try {
        const { data, error } = await supabase
          .from('payment_methods')
          .select('*')
          .eq('user_id', effectiveUserId)
          .order('is_default', { ascending: false })

        if (error) throw error
        if (data) {
          const mapped: SavedPaymentMethod[] = data.map(m => ({
            id: m.id,
            type: m.type,
            name: m.name,
            isDefault: m.is_default,
            details: m.details || {},
          }))
          setSavedMethods(mapped)

          const defaultMethod = mapped.find(m => m.isDefault)
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
  }, [effectiveUserId])

  // Check Stripe Connect
  useEffect(() => {
    if (!user?.id) return
    const checkStripe = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('stripe_account_id, stripe_connected')
        .eq('id', user.id)
        .single()

      if (data?.stripe_connected && data?.stripe_account_id) {
        setStripeAccountId(data.stripe_account_id)
        setUseStripePayment(true)
      } else {
        setUseStripePayment(false)
      }
    }
    checkStripe()
  }, [user?.id])

  // ---------- PROFILE / METHOD HELPERS ----------

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

  const handleProfileSelect = (profileId: string) => {
    setSelectedProfileId(profileId)
    if (profileId === 'custom') {
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
      if (profile) applyIssuerProfile(profile)
    }
  }

  const applyPaymentMethod = (method: SavedPaymentMethod) => {
    const typeMap: Record<string, PaymentMethodType> = {
      VIREMENT: 'virement',
      PAYPAL: 'paypal',
      REVOLUT: 'revolut',
      STRIPE: 'stripe',
    }
    setPaymentMethod(typeMap[method.type] || 'virement')

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
      if (method) applyPaymentMethod(method)
    }
  }

  const getPaymentMethodLabel = () => {
    const labels: Record<PaymentMethodType, string> = {
      paypal: 'PayPal',
      virement: 'Virement Bancaire',
      revolut: 'Revolut',
      stripe: 'Stripe',
    }
    return labels[paymentMethod]
  }

  // ---------- FORM VALIDATION ----------

  const validateForm = (): boolean => {
    if (commissionHT <= 0) {
      toast.error('Aucune commission a facturer sur cette periode')
      return false
    }
    if (paymentMethod === 'virement' && (!iban || !bic || !accountHolder) && selectedMethodId === 'custom') {
      toast.error('Veuillez renseigner tous les champs du virement bancaire')
      return false
    }
    if (paymentMethod === 'paypal' && !paypalEmail && selectedMethodId === 'custom') {
      toast.error('Veuillez renseigner votre email PayPal')
      return false
    }
    if (paymentMethod === 'revolut' && !revtag && selectedMethodId === 'custom') {
      toast.error('Veuillez renseigner votre Revtag')
      return false
    }
    if (paymentMethod === 'stripe' && !stripeLink && !useStripePayment && selectedMethodId === 'custom') {
      toast.error('Veuillez renseigner votre lien de paiement Stripe')
      return false
    }
    return true
  }

  // ---------- PREVIEW (Step 1 -> 2) ----------

  const handlePreview = async () => {
    if (!validateForm()) return

    // Generate Stripe link if enabled
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
            clientEmail: businessSettings?.billing_email || undefined,
          }),
        })
        const data = await response.json()
        if (data.url) {
          setGeneratedLink(data.url)
          const qrDataUrl = await QRCode.toDataURL(data.url, {
            width: 150,
            margin: 1,
            color: { dark: '#0F172A', light: '#FFFFFF' },
          })
          setQrCodeUrl(qrDataUrl)
        } else {
          console.error('Erreur Link:', data)
          toast.error('Erreur lors de la creation du lien Stripe. La facture sera generee sans.')
        }
      } catch (e) {
        console.error('Erreur API:', e)
        toast.error('Impossible de joindre le serveur de paiement.')
      } finally {
        setIsGeneratingLink(false)
      }
    }

    setStep(2)
  }

  // ---------- PDF GENERATION HELPER ----------

  const generatePdfBlob = async (): Promise<Blob> => {
    const element = document.getElementById('invoice-preview-content')
    if (!element) throw new Error('Element de preview introuvable')

    const opt = {
      margin: 0,
      filename: `${invoiceNumber}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    }
    return html2pdf().set(opt).from(element).output('blob')
  }

  const uploadPdfAndSave = async (pdfBlob: Blob, status: string) => {
    // Upload to storage
    const fileName = `${Date.now()}-${invoiceNumber}.pdf`
    const { error: uploadError } = await supabase.storage.from('invoice').upload(fileName, pdfBlob)
    if (uploadError) throw uploadError

    // Get public URL
    const { data: { publicUrl } } = supabase.storage.from('invoice').getPublicUrl(fileName)

    // Save to invoices table
    const { error: insertError } = await supabase.from('invoices').insert([{
      invoice_number: invoiceNumber,
      offer_name: `Commission ${new Date(startDate).toLocaleDateString('fr-FR')} - ${new Date(endDate).toLocaleDateString('fr-FR')}`,
      client_name: receiverInfo.company || receiverInfo.name,
      client_email: businessSettings?.billing_email || null,
      amount_ht: commissionHT,
      amount_ttc: totalTTC,
      status,
      pdf_url: publicUrl,
      stripe_payment_link: generatedLink || null,
      team_member_id: teamMember?.id || null,
      user_id: effectiveUserId,
      late_penalty_rate: latePenaltyRate,
      late_penalty_fixed: latePenaltyFixed,
    }])
    if (insertError) throw insertError

    return publicUrl
  }

  // ---------- EXPORT PDF ----------

  const handleExportPDF = async () => {
    setIsExporting(true)
    try {
      const pdfBlob = await generatePdfBlob()
      await uploadPdfAndSave(pdfBlob, 'generee')

      // Local download
      const link = document.createElement('a')
      link.href = URL.createObjectURL(pdfBlob)
      link.download = `${invoiceNumber}.pdf`
      link.click()

      toast.success('Facture exportee avec succes !')
      onClose()
    } catch (err) {
      console.error('Erreur export PDF:', err)
      toast.error('Une erreur est survenue lors de l\'export.')
    } finally {
      setIsExporting(false)
    }
  }

  // ---------- SEND EMAIL ----------

  const recipientEmail = businessSettings?.billing_email || ''

  const handleSendEmail = async () => {
    if (!recipientEmail) {
      toast.error('Aucun email destinataire configure dans les parametres')
      return
    }

    setIsSendingEmail(true)
    try {
      const pdfBlob = await generatePdfBlob()
      const publicUrl = await uploadPdfAndSave(pdfBlob, 'envoyee')

      const periodLabel = `${new Date(startDate).toLocaleDateString('fr-FR')} au ${new Date(endDate).toLocaleDateString('fr-FR')}`
      const emailPayload = {
        sender: { name: 'CloseOS Notification', email: 'support@closeos.fr' },
        replyTo: { email: issuerEmail || 'support@closeos.fr', name: issuerCompanyName || 'CloseOS' },
        to: [{ email: recipientEmail, name: receiverInfo.company || receiverInfo.name }],
        subject: `Facture ${invoiceNumber} - Commission du ${periodLabel}`,
        htmlContent: `
          <html>
            <body>
              <h1>Bonjour,</h1>
              <p>Veuillez trouver ci-joint la facture n&deg; <strong>${invoiceNumber}</strong> correspondant &agrave; la p&eacute;riode du ${periodLabel}.</p>
              <p>Vous pouvez la t&eacute;l&eacute;charger directement via ce lien : <br>
              <a href="${publicUrl}">T&eacute;l&eacute;charger la facture (PDF)</a></p>
              ${generatedLink ? `
                <br>
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb;">
                  <p style="margin: 0 0 10px 0;"><strong>R&egrave;glement en ligne :</strong></p>
                  <a href="${generatedLink}" style="background-color: #635BFF; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Payer par Carte Bancaire</a>
                </div>
              ` : ''}
              <br>
              <p>Cordialement,<br>${issuerCompanyName || "L'equipe"}</p>
            </body>
          </html>
        `,
        attachment: [{ url: publicUrl, name: `${invoiceNumber}.pdf` }],
      }

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailPayload),
      })

      if (!response.ok) throw new Error("Erreur lors de l'envoi de l'email")

      toast.success(`Facture envoyee a ${clientEmail} !`)
      onClose()
    } catch (err) {
      console.error('Erreur envoi email:', err)
      toast.error("Une erreur est survenue lors de l'envoi.")
    } finally {
      setIsSendingEmail(false)
    }
  }

  // ---------- RESET ON CLOSE ----------

  const handleClose = () => {
    setStep(1)
    setInvoiceNumber(`FAC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`)
    setTvaApplicable(false)
    setLatePenaltyRate(15)
    setLatePenaltyFixed(40)
    setGeneratedLink('')
    setQrCodeUrl('')
    onClose()
  }

  if (!isOpen) return null

  // ---------- INPUT CLASSES ----------

  const inputCls = 'w-full rounded-lg border border-[#c4c7c7]/30 dark:border-neutral-700 bg-[#f5f3f2] dark:bg-neutral-800 px-4 py-2.5 text-sm text-[#1b1c1b] dark:text-white focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49] outline-none transition-colors'
  const labelCls = 'text-sm font-medium text-[#444748] dark:text-neutral-400 mb-2 block'

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleClose}
    >
      <div
        className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl ring-1 ring-[#c4c7c7]/20 dark:ring-neutral-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 z-10 rounded-lg p-2 text-[#444748] hover:bg-[#eae8e7] dark:hover:bg-neutral-800 dark:text-neutral-400 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* ==================== STEP 1: CONFIGURATION ==================== */}
        {step === 1 && (
          <div className="p-8">
            <h2 className="mb-6 text-2xl font-bold text-[#1b1c1b] dark:text-white">
              Configuration de la Facture
            </h2>

            <div className="space-y-6">
              {/* Invoice Number */}
              <div>
                <label className={labelCls}>Numero de Facture</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className={inputCls}
                  placeholder="Ex: FAC-2026-001234"
                />
              </div>

              {/* Saved Issuer Profiles */}
              {savedProfiles.length > 0 && (
                <div>
                  <label className={labelCls}>Profil Emetteur Enregistre</label>
                  <select
                    value={selectedProfileId}
                    onChange={(e) => handleProfileSelect(e.target.value)}
                    className={inputCls}
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

              {/* Manual Issuer Fields (only if custom) */}
              {selectedProfileId === 'custom' && (
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Nom / Raison Sociale de l'Emetteur</label>
                    <input type="text" value={issuerCompanyName} onChange={(e) => setIssuerCompanyName(e.target.value)} className={inputCls} placeholder="Ex: ACME SARL, Jean Dupont EI..." />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Adresse</label>
                      <input type="text" value={issuerAddress} onChange={(e) => setIssuerAddress(e.target.value)} className={inputCls} placeholder="123 Rue de la Paix" />
                    </div>
                    <div>
                      <label className={labelCls}>Ville</label>
                      <input type="text" value={issuerCity} onChange={(e) => setIssuerCity(e.target.value)} className={inputCls} placeholder="Paris" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={labelCls}>Code Postal</label>
                      <input type="text" value={issuerZip} onChange={(e) => setIssuerZip(e.target.value)} className={inputCls} placeholder="75001" />
                    </div>
                    <div>
                      <label className={labelCls}>Pays</label>
                      <input type="text" value={issuerCountry} onChange={(e) => setIssuerCountry(e.target.value)} className={inputCls} placeholder="France" />
                    </div>
                    <div>
                      <label className={labelCls}>SIRET</label>
                      <input type="text" value={issuerSiret} onChange={(e) => setIssuerSiret(e.target.value)} className={inputCls} placeholder="123 456 789 00012" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Email</label>
                      <input type="email" value={issuerEmail} onChange={(e) => setIssuerEmail(e.target.value)} className={inputCls} placeholder="contact@entreprise.com" />
                    </div>
                    <div>
                      <label className={labelCls}>Telephone</label>
                      <input type="tel" value={issuerPhone} onChange={(e) => setIssuerPhone(e.target.value)} className={inputCls} placeholder="+33 1 23 45 67 89" />
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Method Section */}
              <div className="space-y-4 rounded-xl border border-[#c4c7c7]/20 dark:border-neutral-700 bg-[#f5f3f2]/50 dark:bg-white/5 p-5">
                <h3 className="text-sm font-bold text-[#1b1c1b] dark:text-white flex items-center gap-2">
                  <Download className="h-4 w-4 text-[#006c49]" />
                  Moyen de paiement principal
                </h3>

                {savedMethods.length > 0 && (
                  <select value={selectedMethodId} onChange={(e) => handleMethodSelect(e.target.value)} className={inputCls}>
                    <option value="custom">Saisie manuelle...</option>
                    {savedMethods.map(m => <option key={m.id} value={m.id}>{m.name} ({m.type})</option>)}
                  </select>
                )}

                {selectedMethodId === 'custom' && (
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethodType)} className={inputCls}>
                    <option value="virement">Virement Bancaire</option>
                    <option value="paypal">PayPal</option>
                    <option value="revolut">Revolut</option>
                    <option value="stripe">Autre lien manuel</option>
                  </select>
                )}

                {/* Dynamic payment fields */}
                {paymentMethod === 'virement' && (
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" value={iban} onChange={(e) => setIban(e.target.value)} placeholder="IBAN" className={cn(inputCls, 'col-span-2')} />
                    <input type="text" value={bic} onChange={(e) => setBic(e.target.value)} placeholder="BIC" className={inputCls} />
                    <input type="text" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} placeholder="Titulaire" className={inputCls} />
                  </div>
                )}
                {paymentMethod === 'paypal' && <input type="email" value={paypalEmail} onChange={(e) => setPaypalEmail(e.target.value)} placeholder="Email PayPal" className={inputCls} />}
                {paymentMethod === 'revolut' && <input type="text" value={revtag} onChange={(e) => setRevtag(e.target.value)} placeholder="Revtag" className={inputCls} />}
                {paymentMethod === 'stripe' && <input type="text" value={stripeLink} onChange={(e) => setStripeLink(e.target.value)} placeholder="Lien Stripe" className={inputCls} />}
              </div>

              {/* Stripe Connect Toggle */}
              {stripeAccountId && (
                <div className="rounded-xl border border-[#635BFF]/30 bg-[#635BFF]/5 dark:bg-[#635BFF]/10 p-4">
                  <label className="flex cursor-pointer items-start gap-3">
                    <div className="relative mt-1">
                      <input
                        type="checkbox"
                        checked={useStripePayment}
                        onChange={(e) => setUseStripePayment(e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="h-5 w-9 rounded-full bg-[#c4c7c7] peer-checked:bg-[#635BFF] transition-colors"></div>
                      <div className="absolute left-1 top-1 h-3 w-3 rounded-full bg-white transition-transform peer-checked:translate-x-4"></div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm font-bold text-[#1b1c1b] dark:text-white">
                        Service de reglement en ligne (Stripe)
                        <span className="rounded bg-[#635BFF] px-1.5 py-0.5 text-[10px] uppercase text-white font-bold">Recommande</span>
                      </div>
                      <p className="mt-1 text-xs text-[#635BFF]/80 dark:text-[#635BFF]/70">
                        Ajoute un bouton de paiement securise + QR Code sur la facture pour se faire payer par CB instantanement.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* TVA Toggle */}
              <div className="rounded-xl border border-[#c4c7c7]/20 dark:border-neutral-700 bg-[#f5f3f2]/50 dark:bg-white/5 p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={tvaApplicable}
                      onChange={(e) => setTvaApplicable(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="h-6 w-11 rounded-full bg-[#c4c7c7] peer-checked:bg-[#006c49] transition-colors"></div>
                    <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5"></div>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-[#1b1c1b] dark:text-white">TVA Applicable ?</div>
                    <div className="mt-1 text-xs text-[#444748] dark:text-neutral-400">
                      Ajouter 20% de TVA au montant de la commission
                    </div>
                  </div>
                </label>
              </div>

              {/* Late Payment Penalties */}
              <div className="rounded-xl border border-[#c4c7c7]/20 dark:border-neutral-700 bg-[#f5f3f2]/50 dark:bg-white/5 p-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#444748] dark:text-neutral-400 mb-3">
                  Penalites de retard
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Taux annuel (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={latePenaltyRate}
                      onChange={(e) => setLatePenaltyRate(parseFloat(e.target.value) || 0)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Indemnite forfaitaire (EUR)</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={latePenaltyFixed}
                      onChange={(e) => setLatePenaltyFixed(parseFloat(e.target.value) || 0)}
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>

              {/* Preview Button */}
              <button
                type="button"
                onClick={handlePreview}
                disabled={isGeneratingLink}
                className="w-full rounded-xl bg-[#006c49] px-6 py-3.5 font-bold text-white transition-all hover:bg-[#005a3d] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isGeneratingLink ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Generation du lien Stripe...
                  </>
                ) : (
                  'Previsualiser la facture'
                )}
              </button>
            </div>
          </div>
        )}

        {/* ==================== STEP 2: PREVIEW ==================== */}
        {step === 2 && (
          <div className="p-8">
            {/* Actions bar */}
            <div className="mb-6 flex items-center justify-between gap-4">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-2 rounded-full border border-[#c4c7c7]/20 dark:border-neutral-700 px-4 py-2 text-sm font-semibold text-[#444748] dark:text-neutral-300 hover:bg-[#f5f3f2] dark:hover:bg-neutral-800 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Modifier
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleSendEmail}
                  disabled={!recipientEmail || isSendingEmail}
                  className={cn(
                    'flex items-center gap-2 rounded-full px-6 py-2 font-bold transition-all',
                    !recipientEmail
                      ? 'bg-[#f5f3f2] dark:bg-neutral-800 text-[#c4c7c7] dark:text-neutral-600 cursor-not-allowed'
                      : 'bg-[#635BFF] text-white hover:bg-[#5349E0]'
                  )}
                  title={!recipientEmail ? 'Aucun email destinataire configure' : 'Envoyer la facture par mail'}
                >
                  {isSendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  {isSendingEmail ? 'Envoi...' : 'Envoyer par mail'}
                </button>

                <button
                  onClick={handleExportPDF}
                  disabled={isExporting}
                  className="flex items-center gap-2 bg-[#1b1c1b] dark:bg-white text-white dark:text-neutral-900 rounded-full px-6 py-2 font-bold hover:bg-[#1b1c1b]/80 dark:hover:bg-neutral-200 transition-colors disabled:opacity-50"
                >
                  {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {isExporting ? 'Export...' : 'Exporter PDF'}
                </button>
              </div>
            </div>

            {/* Invoice A4 Preview */}
            <div className="rounded-xl border border-[#c4c7c7]/10 dark:border-neutral-700 bg-white p-8 shadow-lg overflow-x-auto">
              <div
                id="invoice-preview-content"
                ref={invoiceRef}
                className="mx-auto flex flex-col justify-between"
                style={{
                  backgroundColor: 'white',
                  color: 'black',
                  width: '210mm',
                  minHeight: '297mm',
                  padding: '20mm',
                  boxSizing: 'border-box',
                }}
              >
                {/* Top content wrapper */}
                <div>
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <h1 style={{ fontSize: '2.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>FACTURE</h1>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '0.875rem', color: '#475569', margin: 0 }}>
                        {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>

                  {/* Invoice Number */}
                  <div style={{ fontSize: '0.875rem', color: '#334155', marginTop: '0.5rem', marginBottom: '2rem' }}>
                    <p style={{ margin: 0 }}>
                      <span style={{ fontWeight: 600 }}>Numero de facture:</span> {invoiceNumber}
                    </p>
                  </div>

                  {/* 2-column grid: Emetteur / Destinataire */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                    {/* Emetteur */}
                    <div>
                      <p style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.5rem' }}>
                        Emetteur
                      </p>
                      <div style={{ fontSize: '0.875rem', color: '#0f172a' }}>
                        <p style={{ fontWeight: 700, margin: '0 0 0.25rem 0' }}>{issuerCompanyName || issuerName || 'Emetteur'}</p>
                        {(issuerAddress || issuerCity || issuerZip || issuerCountry) && (
                          <div style={{ color: '#334155', marginBottom: '0.25rem' }}>
                            {issuerAddress && <p style={{ margin: 0 }}>{issuerAddress}</p>}
                            {(issuerZip || issuerCity) && (
                              <p style={{ margin: 0 }}>{issuerZip && `${issuerZip} `}{issuerCity}</p>
                            )}
                            {issuerCountry && <p style={{ margin: 0 }}>{issuerCountry}</p>}
                          </div>
                        )}
                        {issuerSiret && <p style={{ color: '#334155', margin: '0.125rem 0' }}><span style={{ fontWeight: 500 }}>SIRET:</span> {issuerSiret}</p>}
                        {issuerEmail && <p style={{ color: '#334155', margin: '0.125rem 0' }}><span style={{ fontWeight: 500 }}>Email:</span> {issuerEmail}</p>}
                        {issuerPhone && <p style={{ color: '#334155', margin: '0.125rem 0' }}><span style={{ fontWeight: 500 }}>Tel:</span> {issuerPhone}</p>}
                      </div>
                    </div>

                    {/* Destinataire */}
                    <div>
                      <p style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.5rem' }}>
                        Destinataire
                      </p>
                      <div style={{ fontSize: '0.875rem', color: '#0f172a' }}>
                        <p style={{ fontWeight: 700, margin: '0 0 0.25rem 0' }}>{receiverInfo.company || 'Organisation'}</p>
                        {receiverInfo.billingAddress && <p style={{ color: '#334155', margin: '0.125rem 0' }}>{receiverInfo.billingAddress}</p>}
                        {(receiverInfo.billingZip || receiverInfo.billingCity) && (
                          <p style={{ color: '#334155', margin: '0.125rem 0' }}>{receiverInfo.billingZip} {receiverInfo.billingCity}</p>
                        )}
                        {receiverInfo.billingCountry && <p style={{ color: '#334155', margin: '0.125rem 0' }}>{receiverInfo.billingCountry}</p>}
                        {receiverInfo.siret && <p style={{ color: '#334155', margin: '0.125rem 0' }}><span style={{ fontWeight: 500 }}>SIRET:</span> {receiverInfo.siret}</p>}
                        {receiverInfo.tva && <p style={{ color: '#334155', margin: '0.125rem 0' }}><span style={{ fontWeight: 500 }}>TVA:</span> {receiverInfo.tva}</p>}
                      </div>
                    </div>
                  </div>

                  {/* Period */}
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginBottom: '2rem' }}>
                    <p style={{ fontSize: '0.875rem', color: '#334155', margin: 0 }}>
                      <span style={{ fontWeight: 600 }}>Periode:</span>{' '}
                      Du {new Date(startDate).toLocaleDateString('fr-FR')} au {new Date(endDate).toLocaleDateString('fr-FR')}
                    </p>
                  </div>

                  {/* Closer Line Items */}
                  {closerLineItems.length > 0 && (
                    <>
                      <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.5rem' }}>
                        Commission Closer ({commissionRate}%)
                      </p>
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid #0f172a', backgroundColor: '#f8fafc' }}>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>Description</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>Qte</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>Prix Unitaire</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>Total HT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {closerLineItems.map((item, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#0f172a' }}>
                                <p style={{ fontWeight: 500, margin: 0 }}>{item.description}</p>
                              </td>
                              <td style={{ padding: '1rem', textAlign: 'center', fontSize: '0.875rem', color: '#0f172a' }}>{item.count}</td>
                              <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', color: '#0f172a' }}>{formatCurrency(item.unitPrice)}</td>
                              <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>{formatCurrency(item.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}

                  {/* Setter Line Items */}
                  {setterLineItems.length > 0 && (
                    <>
                      <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.5rem' }}>
                        Commission Setter ({commissionRate}%)
                      </p>
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid #0f172a', backgroundColor: '#f8fafc' }}>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>Description</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>Qte</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>Prix Unitaire</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>Total HT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {setterLineItems.map((item, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#0f172a' }}>
                                <p style={{ fontWeight: 500, margin: 0 }}>{item.description}</p>
                              </td>
                              <td style={{ padding: '1rem', textAlign: 'center', fontSize: '0.875rem', color: '#0f172a' }}>{item.count}</td>
                              <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', color: '#0f172a' }}>{formatCurrency(item.unitPrice)}</td>
                              <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>{formatCurrency(item.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}

                  {/* Totals */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2rem' }}>
                    <div style={{ width: '20rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                        <span style={{ color: '#334155' }}>Total HT</span>
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>{formatCurrency(commissionHT)}</span>
                      </div>
                      {tvaApplicable && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                          <span style={{ color: '#334155' }}>TVA (20%)</span>
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>{formatCurrency(tvaAmount)}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0f172a', paddingTop: '0.5rem', fontSize: '1.125rem' }}>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>Total {tvaApplicable ? 'TTC' : ''}</span>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>{formatCurrency(totalTTC)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div style={{ marginTop: 'auto', paddingTop: '2rem', borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    {/* Left - Payment info */}
                    <div style={{ maxWidth: '50%' }}>
                      <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.75rem' }}>
                        Conditions de reglement
                      </p>
                      <div style={{ fontSize: '0.875rem', color: '#334155' }}>
                        <p style={{ margin: '0.25rem 0' }}>
                          <span style={{ fontWeight: 500 }}>Echeance:</span> A reception
                        </p>
                        <p style={{ margin: '0.25rem 0' }}>
                          <span style={{ fontWeight: 500 }}>Mode de reglement:</span> {getPaymentMethodLabel()}
                        </p>

                        {/* Bank details for virement */}
                        {paymentMethod === 'virement' && (
                          <div style={{ marginTop: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', backgroundColor: '#f8fafc', padding: '0.75rem' }}>
                            <p style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: '#475569', marginBottom: '0.5rem' }}>
                              Coordonnees bancaires
                            </p>
                            <div style={{ fontSize: '0.75rem' }}>
                              <p style={{ margin: '0.125rem 0' }}><span style={{ fontWeight: 500 }}>IBAN:</span> {iban}</p>
                              <p style={{ margin: '0.125rem 0' }}><span style={{ fontWeight: 500 }}>BIC:</span> {bic}</p>
                              <p style={{ margin: '0.125rem 0' }}><span style={{ fontWeight: 500 }}>Titulaire:</span> {accountHolder}</p>
                            </div>
                          </div>
                        )}

                        {paymentMethod === 'paypal' && (
                          <p style={{ margin: '0.25rem 0' }}><span style={{ fontWeight: 500 }}>PayPal:</span> {paypalEmail}</p>
                        )}
                        {paymentMethod === 'revolut' && (
                          <p style={{ margin: '0.25rem 0' }}><span style={{ fontWeight: 500 }}>Revolut:</span> {revtag}</p>
                        )}
                        {paymentMethod === 'stripe' && stripeLink && (
                          <p style={{ margin: '0.25rem 0', wordBreak: 'break-all' }}>
                            <span style={{ fontWeight: 500 }}>Lien Stripe:</span>{' '}
                            <a href={stripeLink} style={{ color: '#2563eb', textDecoration: 'underline' }}>{stripeLink}</a>
                          </p>
                        )}

                        {/* VAT exemption */}
                        {!tvaApplicable && (
                          <div style={{ marginTop: '1rem', borderLeft: '4px solid #006c49', backgroundColor: '#f0fdf4', padding: '0.75rem', borderRadius: '0.25rem' }}>
                            <p style={{ fontSize: '0.75rem', fontWeight: 600, fontStyle: 'italic', color: '#0f172a', margin: 0 }}>
                              TVA non applicable, art. 293 B du CGI
                            </p>
                          </div>
                        )}

                        {/* Late penalties mention */}
                        <div style={{ marginTop: '0.75rem', fontSize: '0.6875rem', color: '#64748b' }}>
                          <p style={{ margin: '0.125rem 0' }}>
                            En cas de retard de paiement, penalites de retard au taux annuel de {latePenaltyRate}%.
                          </p>
                          <p style={{ margin: '0.125rem 0' }}>
                            Indemnite forfaitaire pour frais de recouvrement : {formatCurrency(latePenaltyFixed)}.
                          </p>
                        </div>

                      </div>
                    </div>

                    {/* Right - Stripe QR Code */}
                    {generatedLink && qrCodeUrl && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '0.25rem' }}>Payer en ligne</p>
                          <p style={{ fontSize: '0.625rem', color: '#94a3b8', marginBottom: '0.5rem', maxWidth: '120px' }}>
                            Scannez pour regler par CB instantanement
                          </p>
                          <a
                            href={generatedLink}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: 'inline-block',
                              backgroundColor: '#635BFF',
                              color: 'white',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              padding: '0.375rem 0.75rem',
                              borderRadius: '0.25rem',
                              textDecoration: 'none',
                            }}
                          >
                            Payer maintenant &rarr;
                          </a>
                        </div>
                        <img src={qrCodeUrl} alt="QR Code Paiement" style={{ width: '80px', height: '80px' }} />
                      </div>
                    )}
                  </div>

                  {/* Legal footer */}
                  <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.625rem', color: '#94a3b8', margin: 0 }}>
                      Facture generee automatiquement par CloseOS
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
