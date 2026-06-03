import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { X, ChevronLeft, Download, Loader2, Mail, Plus, Trash2, Pencil, CheckCircle2 } from 'lucide-react'
import type { Offer } from './OfferDetailModal'
import type { Prospect } from '../contexts/ProspectsContext'
import type { PaymentMethod as SavedPaymentMethod } from './PaymentMethodsModal'
import type { IssuerProfile } from './IssuerProfilesModal'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/utils'
import toast from 'react-hot-toast'
// @ts-ignore - html2pdf.js doesn't have types
import html2pdf from 'html2pdf.js'
import QRCode from 'qrcode'

interface InvoiceGeneratorModalProps {
  offer: Offer
  deals: Prospect[]
  commission: number
  startDate: string
  endDate: string
  onClose: () => void
}

type PaymentMethodType = 'paypal' | 'virement' | 'revolut' | 'stripe'

interface EditableLineItem {
  id: string
  description: string
  subtitle: string
  count: number
  unitPrice: number
  section: 'commission' | 'custom'
}

export function InvoiceGeneratorModal({
  offer,
  deals,
  commission,
  startDate,
  endDate,
  onClose,
}: InvoiceGeneratorModalProps) {
  const { lang } = useLanguage()
  const invoiceRef = useRef<HTMLDivElement>(null)

  // Step
  const [step, setStep] = useState<1 | 2>(1)

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

  // Invoice metadata
  const [invoiceNumber, setInvoiceNumber] = useState('')

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
  const [showStripeOnInvoice, setShowStripeOnInvoice] = useState(true)

  // Late payment penalties
  const [latePenaltyRate, setLatePenaltyRate] = useState(15)
  const [latePenaltyFixed, setLatePenaltyFixed] = useState(40)

  // Email sending
  const [isSendingEmail, setIsSendingEmail] = useState(false)

  // Loading state
  const [isValidating, setIsValidating] = useState(false)

  // ---------- EDITABLE LINE ITEMS (Step 2) ----------

  const [editableItems, setEditableItems] = useState<EditableLineItem[]>([])
  const [editableInvoiceTitle, setEditableInvoiceTitle] = useState(lang === 'fr' ? 'FACTURE' : 'INVOICE')
  const [editableEcheance, setEditableEcheance] = useState(lang === 'fr' ? 'A reception' : 'Upon receipt')
  const [editableFooterNote, setEditableFooterNote] = useState('')
  const [editableCustomSectionTitle, setEditableCustomSectionTitle] = useState(lang === 'fr' ? 'Autres' : 'Other')
  const [editablePenaltyText, setEditablePenaltyText] = useState('')

  // ---------- LINE ITEMS COMPUTATION ----------

  const lineItems = useMemo(() => {
    const groups: Record<string, { description: string; count: number; total: number; unitPrice: number }> = {}

    // Standard commission rate from the offer
    let standardRate = 0.10
    const commissionStr = String(offer.commission || '10')
    const match = commissionStr.match(/(\d+(?:\.\d+)?)/)
    if (match) standardRate = parseFloat(match[1]) / 100

    // Period bounds for installment proration
    const pStart = new Date(startDate)
    const pEnd = new Date(endDate); pEnd.setHours(23, 59, 59, 999)

    deals.forEach((deal: any) => {
      const isInstallment = deal.payment_type === 'installments' || (deal.installments && deal.installments > 1)
      const formulaName = deal.offer || offer.name

      // Commission inhabituelle: ligne séparée
      const dealRate = deal.custom_commission_rate != null ? Number(deal.custom_commission_rate) / 100 : standardRate
      const hasCustomRate = deal.custom_commission_rate != null
      const customSchedule: { month: number; amount: number }[] | null = Array.isArray(deal.installments_schedule)
        ? deal.installments_schedule
        : null
      const ratePct = (dealRate * 100).toFixed(dealRate * 100 % 1 === 0 ? 0 : 1)

      // Acompte
      const depositAmount = deal.deposit_amount != null ? Number(deal.deposit_amount) : 0
      const hasDeposit = depositAmount > 0
      const depositToRefund = !!deal.deposit_to_refund
      const depositKept = hasDeposit && !depositToRefund
      const depositDate = deal.deposit_date ? new Date(deal.deposit_date) : null
      const depositInPeriod = !!(depositDate && depositDate >= pStart && depositDate <= pEnd)

      const paymentLabel = isInstallment
        ? (customSchedule
            ? (lang === 'fr' ? `Plusieurs fois personnalisé (${deal.installments}x)` : `Custom installments (${deal.installments}x)`)
            : (lang === 'fr' ? `Mensualite (Paiement en ${deal.installments}x)` : `Installment (Payment in ${deal.installments}x)`))
        : (lang === 'fr' ? 'Paiement Comptant' : 'Full Payment')
      const rateLabel = hasCustomRate ? ` (${ratePct}%)` : ''
      const key = `${formulaName}-${paymentLabel}${rateLabel}`

      const fullValue = deal.value || 0

      // Plan de paiement effectif (hors acompte conservé)
      const planFullValue = depositKept ? Math.max(0, fullValue - depositAmount) : fullValue
      const planMonths = (isInstallment && depositKept) ? Math.max(1, (deal.installments || 1) - 1) : (deal.installments || 1)

      // Compute amount that falls in [pStart, pEnd]
      let amountInPeriod: number
      if (!isInstallment) {
        // Comptant : si acompte conservé, le solde comptant = fullValue - depositAmount
        // Sa date "d'arrivée" reste la date du deal
        amountInPeriod = planFullValue
      } else {
        const dealDate = new Date(deal.last_contact || deal.created_at || '')
        if (customSchedule && customSchedule.length > 0) {
          // Sum of custom installments whose due-date falls in [pStart, pEnd]
          amountInPeriod = customSchedule.reduce((s, e) => {
            const instDate = new Date(dealDate)
            instDate.setMonth(instDate.getMonth() + (e.month - 1))
            return s + (instDate >= pStart && instDate <= pEnd ? Number(e.amount) || 0 : 0)
          }, 0)
        } else {
          const monthlyValue = planMonths > 0 ? planFullValue / planMonths : 0
          let count = 0
          for (let i = 0; i < planMonths; i++) {
            const instDate = new Date(dealDate)
            instDate.setMonth(instDate.getMonth() + i)
            if (instDate >= pStart && instDate <= pEnd) count++
          }
          amountInPeriod = monthlyValue * count
        }
      }

      const dealCommission = amountInPeriod * dealRate

      if (amountInPeriod > 0) {
        if (!groups[key]) {
          groups[key] = {
            description: `${formulaName} - ${paymentLabel}${rateLabel}`,
            count: 0,
            total: 0,
            unitPrice: dealCommission,
          }
        }
        groups[key].count++
        groups[key].total += dealCommission
      }

      // Ligne acompte (si versé dans la période)
      if (hasDeposit && depositInPeriod) {
        const depositLabel = depositToRefund
          ? (lang === 'fr' ? 'Acompte (à rembourser)' : 'Deposit (to refund)')
          : (lang === 'fr' ? 'Acompte' : 'Deposit')
        const depositKey = `${formulaName}-${depositLabel}${rateLabel}`
        const depositCommission = depositKept ? depositAmount * dealRate : 0
        if (!groups[depositKey]) {
          groups[depositKey] = {
            description: `${formulaName} - ${depositLabel}${rateLabel}`,
            count: 0,
            total: 0,
            unitPrice: depositCommission,
          }
        }
        groups[depositKey].count++
        groups[depositKey].total += depositCommission
      }
    })

    return Object.values(groups)
  }, [deals, offer, lang, startDate, endDate])

  const fixedFeeAmount = offer.hasFixedFee ? parseFloat(offer.fixedFeeAmount || '0') || 0 : 0
  const commissionHT = lineItems.reduce((acc, item) => acc + item.total, 0) + fixedFeeAmount
  const tvaAmount = tvaApplicable ? commissionHT * tvaRate : 0
  const totalTTC = commissionHT + tvaAmount

  // Initialize editable items when entering step 2
  const initEditableItems = useCallback(() => {
    const items: EditableLineItem[] = []

    lineItems.forEach((item, i) => {
      items.push({
        id: `commission-${i}`,
        description: item.description,
        subtitle: lang === 'fr' ? `Commission sur ${item.count} vente(s)` : `Commission on ${item.count} sale(s)`,
        count: item.count,
        unitPrice: item.total / item.count,
        section: 'commission',
      })
    })

    if (fixedFeeAmount > 0) {
      items.push({
        id: 'fixed-fee',
        description: lang === 'fr' ? 'Fixe' : 'Fixed',
        subtitle: lang === 'fr' ? 'Remuneration fixe mensuelle' : 'Monthly fixed compensation',
        count: 1,
        unitPrice: fixedFeeAmount,
        section: 'commission',
      })
    }

    setEditableItems(items)
  }, [lineItems, fixedFeeAmount, lang])

  const updateItem = (id: string, field: keyof EditableLineItem, value: any) => {
    setEditableItems(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ))
  }

  const removeItem = (id: string) => {
    setEditableItems(prev => prev.filter(item => item.id !== id))
  }

  const addItem = (section: 'commission' | 'custom') => {
    setEditableItems(prev => [...prev, {
      id: `custom-${Date.now()}`,
      description: lang === 'fr' ? 'Nouvelle ligne' : 'New line',
      subtitle: '',
      count: 1,
      unitPrice: 0,
      section,
    }])
  }

  // Computed totals from editable items
  const editableCommissionItems = editableItems.filter(i => i.section === 'commission')
  const editableCustomItems = editableItems.filter(i => i.section === 'custom')

  const editableTotalHT = editableItems.reduce((sum, item) => sum + item.count * item.unitPrice, 0)
  const editableTvaAmount = tvaApplicable ? editableTotalHT * tvaRate : 0
  const editableTotalTTC = editableTotalHT + editableTvaAmount

  // ---------- FORMAT ----------

  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(amount)

  // ---------- DATA LOADING ----------

  // Generate next invoice number (FAC-YYYY-XX sequential)
  useEffect(() => {
    const loadNextNumber = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const year = new Date().getFullYear()
      const { count, error } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .like('invoice_number', `FAC-${year}-%`)

      const next = (count || 0) + 1
      setInvoiceNumber(`FAC-${year}-${String(next).padStart(2, '0')}`)
    }
    loadNextNumber()
  }, [])

  // Stripe check
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
          setUseStripePayment(true)
        } else {
          setUseStripePayment(false)
        }
      }
    }
    checkStripe()
  }, [])

  // Load issuer profiles
  useEffect(() => {
    const loadProfiles = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase
          .from('issuer_profiles')
          .select('*')
          .eq('user_id', user.id)
          .order('is_default', { ascending: false })

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

  // Load payment methods
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

          const defaultMethod = mappedMethods.find(m => m.isDefault)
          if (defaultMethod) {
            setSelectedMethodId(defaultMethod.id)
            applyPaymentMethod(defaultMethod)
          }
        }
      } catch (err) {
        console.error('Erreur chargement methodes:', err)
      }
    }
    loadMethods()
  }, [])

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
      virement: lang === 'fr' ? 'Virement Bancaire' : 'Bank Transfer',
      revolut: 'Revolut',
      stripe: 'Stripe',
    }
    return labels[paymentMethod]
  }

  // ---------- FORM VALIDATION ----------

  const validateForm = (): boolean => {
    if (commissionHT <= 0) {
      toast.error(lang === 'fr' ? 'Aucune commission a facturer sur cette periode' : 'No commission to invoice for this period')
      return false
    }
    if (paymentMethod === 'virement' && (!iban || !bic || !accountHolder) && selectedMethodId === 'custom') {
      toast.error(lang === 'fr' ? 'Veuillez renseigner tous les champs du virement bancaire' : 'Please fill in all bank transfer fields')
      return false
    }
    if (paymentMethod === 'paypal' && !paypalEmail && selectedMethodId === 'custom') {
      toast.error(lang === 'fr' ? 'Veuillez renseigner votre email PayPal' : 'Please enter your PayPal email')
      return false
    }
    if (paymentMethod === 'revolut' && !revtag && selectedMethodId === 'custom') {
      toast.error(lang === 'fr' ? 'Veuillez renseigner votre Revtag' : 'Please enter your Revtag')
      return false
    }
    if (paymentMethod === 'stripe' && !stripeLink && !useStripePayment && selectedMethodId === 'custom') {
      toast.error(lang === 'fr' ? 'Veuillez renseigner votre lien de paiement Stripe' : 'Please enter your Stripe payment link')
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
            title: `${lang === 'fr' ? 'Facture' : 'Invoice'} ${invoiceNumber}`,
            connectedAccountId: stripeAccountId,
            clientEmail: offer.billingEmail || undefined,
          }),
        })
        const data = await response.json()
        if (data.url) {
          setGeneratedLink(data.url)
          setShowStripeOnInvoice(true)
          const qrDataUrl = await QRCode.toDataURL(data.url, {
            width: 150,
            margin: 1,
            color: { dark: '#0F172A', light: '#FFFFFF' },
          })
          setQrCodeUrl(qrDataUrl)
        } else {
          console.error('Erreur Link:', data)
          toast.error(lang === 'fr' ? 'Erreur lors de la creation du lien Stripe. La facture sera generee sans.' : 'Error creating Stripe link. The invoice will be generated without it.')
        }
      } catch (e) {
        console.error('Erreur API:', e)
        toast.error(lang === 'fr' ? 'Impossible de joindre le serveur de paiement.' : 'Unable to reach the payment server.')
      } finally {
        setIsGeneratingLink(false)
      }
    }

    initEditableItems()
    setEditablePenaltyText(lang === 'fr'
      ? `En cas de retard de paiement, penalites de retard au taux annuel de ${latePenaltyRate}%.\nIndemnite forfaitaire pour frais de recouvrement : ${formatCurrency(latePenaltyFixed)}.`
      : `In case of late payment, late penalties at an annual rate of ${latePenaltyRate}%.\nFixed compensation for recovery costs: ${formatCurrency(latePenaltyFixed)}.`)
    setStep(2)
  }

  // ---------- PDF GENERATION HELPER ----------

  const generatePdfBlob = async (): Promise<Blob> => {
    const element = document.getElementById('invoice-preview-content')
    if (!element) throw new Error(lang === 'fr' ? 'Element de preview introuvable' : 'Preview element not found')

    // Temporarily reset zoom and set A4 padding for PDF export
    const prevZoom = element.style.zoom
    const prevPadding = element.style.padding
    element.style.zoom = '1'
    element.style.padding = '20mm'

    const opt = {
      margin: 0,
      filename: `${invoiceNumber}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    }
    const blob = await html2pdf().set(opt).from(element).output('blob')

    element.style.zoom = prevZoom
    element.style.padding = prevPadding
    return blob
  }

  const uploadPdfAndSave = async (pdfBlob: Blob, status: string) => {
    const fileName = `${Date.now()}-${invoiceNumber}.pdf`
    const { error: uploadError } = await supabase.storage.from('invoice').upload(fileName, pdfBlob)
    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage.from('invoice').getPublicUrl(fileName)

    const { error: insertError } = await supabase.from('invoices').insert([{
      invoice_number: invoiceNumber,
      offer_name: offer.name,
      client_name: offer.billingName || offer.company,
      client_email: offer.billingEmail || null,
      amount_ht: editableTotalHT,
      amount_ttc: editableTotalTTC,
      status,
      pdf_url: publicUrl,
      stripe_payment_link: generatedLink || null,
      late_penalty_rate: latePenaltyRate,
      late_penalty_fixed: latePenaltyFixed,
    }])
    if (insertError) throw insertError

    return publicUrl
  }

  // ---------- VALIDATE & DOWNLOAD ----------

  const handleValidate = async () => {
    setIsValidating(true)
    try {
      const pdfBlob = await generatePdfBlob()
      await uploadPdfAndSave(pdfBlob, 'generee')

      const link = document.createElement('a')
      link.href = URL.createObjectURL(pdfBlob)
      link.download = `${invoiceNumber}.pdf`
      link.click()

      toast.success(lang === 'fr' ? 'Facture validee et telechargee !' : 'Invoice validated and downloaded!')
      onClose()
    } catch (err) {
      console.error('Erreur validation facture:', err)
      toast.error(lang === 'fr' ? "Une erreur est survenue lors de la validation." : "An error occurred during validation.")
    } finally {
      setIsValidating(false)
    }
  }

  // ---------- SEND EMAIL ----------

  const handleSendEmail = async () => {
    if (!offer.billingEmail) return

    setIsSendingEmail(true)
    try {
      const pdfBlob = await generatePdfBlob()
      const publicUrl = await uploadPdfAndSave(pdfBlob, 'envoyee')

      const emailPayload = {
        sender: { name: "CloseOS Notification", email: "support@closeos.fr" },
        replyTo: { email: issuerEmail || "support@closeos.fr", name: issuerCompanyName || "CloseOS" },
        to: [{ email: offer.billingEmail, name: offer.billingName || offer.company }],
        subject: lang === 'fr' ? `Votre facture ${invoiceNumber} est disponible` : `Your invoice ${invoiceNumber} is available`,
        htmlContent: `
          <html>
            <body>
              <h1>${lang === 'fr' ? 'Bonjour,' : 'Hello,'}</h1>
              <p>${lang === 'fr'
                ? `Veuillez trouver ci-joint votre facture n&deg; <strong>${invoiceNumber}</strong> correspondant a la periode du ${new Date(startDate).toLocaleDateString('fr-FR')} au ${new Date(endDate).toLocaleDateString('fr-FR')}.`
                : `Please find attached your invoice no. <strong>${invoiceNumber}</strong> for the period from ${new Date(startDate).toLocaleDateString('en-US')} to ${new Date(endDate).toLocaleDateString('en-US')}.`
              }</p>

              <p>${lang === 'fr'
                ? `Vous pouvez la telecharger directement via ce lien : <br><a href="${publicUrl}">Telecharger ma facture (PDF)</a>`
                : `You can download it directly via this link: <br><a href="${publicUrl}">Download my invoice (PDF)</a>`
              }</p>

              ${generatedLink ? `
                <br>
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb;">
                  <p style="margin: 0 0 10px 0;"><strong>${lang === 'fr' ? 'Reglement en ligne :' : 'Online payment:'}</strong></p>
                  <a href="${generatedLink}" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">${lang === 'fr' ? 'Payer par Carte Bancaire' : 'Pay by Credit Card'}</a>
                </div>
              ` : ''}

              <br>
              <p>${lang === 'fr' ? 'Cordialement' : 'Best regards'},<br>${issuerCompanyName || (lang === 'fr' ? "L'equipe" : "The team")}</p>
            </body>
          </html>
        `,
        attachment: [{ url: publicUrl, name: `${invoiceNumber}.pdf` }]
      }

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailPayload)
      })

      if (!response.ok) throw new Error(lang === 'fr' ? "Erreur lors de l'envoi de l'email" : "Error sending the email")

      toast.success(lang === 'fr' ? `Facture envoyee a ${offer.billingEmail} !` : `Invoice sent to ${offer.billingEmail}!`)
      onClose()
    } catch (err) {
      console.error("Erreur envoi email:", err)
      toast.error(lang === 'fr' ? "Une erreur est survenue lors de l'envoi de l'email." : "An error occurred while sending the email.")
    } finally {
      setIsSendingEmail(false)
    }
  }

  // ---------- RESET ON CLOSE ----------

  const handleClose = () => {
    setStep(1)
    setTvaApplicable(false)
    setLatePenaltyRate(15)
    setLatePenaltyFixed(40)
    setEditableItems([])
    setEditableFooterNote('')
    setEditableInvoiceTitle(lang === 'fr' ? 'FACTURE' : 'INVOICE')
    setEditableEcheance(lang === 'fr' ? 'A reception' : 'Upon receipt')
    setEditableCustomSectionTitle(lang === 'fr' ? 'Autres' : 'Other')
    setEditablePenaltyText('')
    setGeneratedLink('')
    setQrCodeUrl('')
    setShowStripeOnInvoice(true)
    onClose()
  }

  // ---------- INPUT CLASSES ----------

  const inputCls = 'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors placeholder:text-white/30'
  const labelCls = 'text-sm font-medium text-white/40 mb-2 block'

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
      onClick={handleClose}
    >
      <div
        className={cn(
          "relative bg-[#1a1a1a] rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.2)] ring-1 ring-white/[0.08] w-full",
          step === 2 ? 'max-h-[90vh] overflow-hidden w-full max-w-5xl' : 'max-w-4xl max-h-[90vh] overflow-y-auto'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 z-10 rounded-full p-2 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* ==================== STEP 1: CONFIGURATION ==================== */}
        {step === 1 && (
          <div className="p-4 md:p-8">
            <h2 className="mb-6 text-2xl font-bold text-white">{lang === 'fr' ? 'Configuration de la Facture' : 'Invoice Configuration'}</h2>

            <div className="space-y-6">
              {/* Invoice Number */}
              <div>
                <label className={labelCls}>{lang === 'fr' ? 'Numero de Facture' : 'Invoice Number'}</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className={inputCls}
                  placeholder="Ex: FAC-2026-01"
                />
              </div>

              {/* Saved Issuer Profiles */}
              {savedProfiles.length > 0 && (
                <div>
                  <label className={labelCls}>{lang === 'fr' ? 'Profil Emetteur Enregistre' : 'Saved Issuer Profile'}</label>
                  <select
                    value={selectedProfileId}
                    onChange={(e) => handleProfileSelect(e.target.value)}
                    className={inputCls}
                  >
                    <option value="custom">{lang === 'fr' ? 'Saisie manuelle...' : 'Manual entry...'}</option>
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
                    <label className={labelCls}>{lang === 'fr' ? "Nom / Raison Sociale de l'Emetteur" : 'Issuer Name / Company Name'}</label>
                    <input type="text" value={issuerCompanyName} onChange={(e) => setIssuerCompanyName(e.target.value)} className={inputCls} placeholder={lang === 'fr' ? "Ex: ACME SARL, Jean Dupont EI..." : "E.g.: ACME Ltd, John Doe..."} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>{lang === 'fr' ? 'Adresse' : 'Address'}</label>
                      <input type="text" value={issuerAddress} onChange={(e) => setIssuerAddress(e.target.value)} className={inputCls} placeholder={lang === 'fr' ? "123 Rue de la Paix" : "123 Main Street"} />
                    </div>
                    <div>
                      <label className={labelCls}>{lang === 'fr' ? 'Ville' : 'City'}</label>
                      <input type="text" value={issuerCity} onChange={(e) => setIssuerCity(e.target.value)} className={inputCls} placeholder="Paris" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={labelCls}>{lang === 'fr' ? 'Code Postal' : 'Zip Code'}</label>
                      <input type="text" value={issuerZip} onChange={(e) => setIssuerZip(e.target.value)} className={inputCls} placeholder="75001" />
                    </div>
                    <div>
                      <label className={labelCls}>{lang === 'fr' ? 'Pays' : 'Country'}</label>
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
                      <label className={labelCls}>{lang === 'fr' ? 'Telephone' : 'Phone'}</label>
                      <input type="tel" value={issuerPhone} onChange={(e) => setIssuerPhone(e.target.value)} className={inputCls} placeholder="+33 1 23 45 67 89" />
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Method Section */}
              <div className="space-y-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Download className="h-4 w-4 text-purple-400" />
                  {lang === 'fr' ? 'Moyen de paiement principal' : 'Primary payment method'}
                </h3>

                {savedMethods.length > 0 && (
                  <select value={selectedMethodId} onChange={(e) => handleMethodSelect(e.target.value)} className={inputCls}>
                    <option value="custom">{lang === 'fr' ? 'Saisie manuelle...' : 'Manual entry...'}</option>
                    {savedMethods.map(m => <option key={m.id} value={m.id}>{m.name} ({m.type})</option>)}
                  </select>
                )}

                {selectedMethodId === 'custom' && (
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethodType)} className={inputCls}>
                    <option value="virement">{lang === 'fr' ? 'Virement Bancaire' : 'Bank Transfer'}</option>
                    <option value="paypal">PayPal</option>
                    <option value="revolut">Revolut</option>
                    <option value="stripe">{lang === 'fr' ? 'Autre lien manuel' : 'Other manual link'}</option>
                  </select>
                )}

                {/* Dynamic payment fields */}
                {paymentMethod === 'virement' && (
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" value={iban} onChange={(e) => setIban(e.target.value)} placeholder="IBAN" className={cn(inputCls, 'col-span-2')} />
                    <input type="text" value={bic} onChange={(e) => setBic(e.target.value)} placeholder="BIC" className={inputCls} />
                    <input type="text" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} placeholder={lang === 'fr' ? "Titulaire" : "Account Holder"} className={inputCls} />
                  </div>
                )}
                {paymentMethod === 'paypal' && <input type="email" value={paypalEmail} onChange={(e) => setPaypalEmail(e.target.value)} placeholder="Email PayPal" className={inputCls} />}
                {paymentMethod === 'revolut' && <input type="text" value={revtag} onChange={(e) => setRevtag(e.target.value)} placeholder="Revtag" className={inputCls} />}
                {paymentMethod === 'stripe' && <input type="text" value={stripeLink} onChange={(e) => setStripeLink(e.target.value)} placeholder={lang === 'fr' ? "Lien Stripe" : "Stripe Link"} className={inputCls} />}
              </div>

              {/* Stripe Connect Toggle */}
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
                      <div className="h-5 w-9 rounded-full bg-white/10 peer-checked:bg-indigo-500 transition-colors"></div>
                      <div className="absolute left-1 top-1 h-3 w-3 rounded-full bg-white transition-transform peer-checked:translate-x-4"></div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm font-bold text-white">
                        {lang === 'fr' ? 'Service de reglement en ligne (Stripe)' : 'Online payment service (Stripe)'}
                        <span className="rounded bg-indigo-500 px-1.5 py-0.5 text-[10px] uppercase text-white font-bold">{lang === 'fr' ? 'Recommande' : 'Recommended'}</span>
                      </div>
                      <p className="mt-1 text-xs text-indigo-200">
                        {lang === 'fr' ? 'Ajoute un bouton de paiement securise + QR Code sur la facture pour se faire payer par CB instantanement.' : 'Adds a secure payment button + QR Code on the invoice to get paid by card instantly.'}
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* TVA Toggle */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={tvaApplicable}
                      onChange={(e) => setTvaApplicable(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="h-6 w-11 rounded-full bg-white/10 peer-checked:bg-emerald-500 transition-colors"></div>
                    <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5"></div>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-white">{lang === 'fr' ? 'TVA Applicable ?' : 'VAT Applicable?'}</div>
                    <div className="mt-1 text-xs text-white/40">
                      {lang === 'fr' ? 'Ajouter 20% de TVA au montant de la commission' : 'Add 20% VAT to the commission amount'}
                    </div>
                  </div>
                </label>
              </div>

              {/* Late Payment Penalties */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">
                  {lang === 'fr' ? 'Penalites de retard' : 'Late payment penalties'}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>{lang === 'fr' ? 'Taux annuel (%)' : 'Annual rate (%)'}</label>
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
                    <label className={labelCls}>{lang === 'fr' ? 'Indemnite forfaitaire (EUR)' : 'Fixed compensation (EUR)'}</label>
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
                className="w-full rounded-full bg-emerald-500 px-6 py-3.5 font-bold text-black transition-all hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isGeneratingLink ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {lang === 'fr' ? 'Generation du lien Stripe...' : 'Generating Stripe link...'}
                  </>
                ) : (
                  lang === 'fr' ? 'Previsualiser la facture' : 'Preview invoice'
                )}
              </button>
            </div>
          </div>
        )}

        {/* ==================== STEP 2: EDIT + LIVE PREVIEW ==================== */}
        {step === 2 && (
          <div className="flex flex-col h-[90vh]">
            {/* Actions bar */}
            <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between shrink-0">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-2 rounded-full border border-white/[0.08] px-4 py-2 text-sm font-semibold text-white/60 hover:bg-white/10 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                {lang === 'fr' ? 'Retour' : 'Back'}
              </button>

              <div className="flex items-center gap-3">
                {/* Email button */}
                <button
                  onClick={handleSendEmail}
                  disabled={!offer.billingEmail || isSendingEmail}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-6 py-2.5 font-semibold text-white transition-all border",
                    !offer.billingEmail
                      ? 'bg-white/[0.03] border-white/[0.08] text-white/40 cursor-not-allowed'
                      : 'bg-indigo-500 border-indigo-500 hover:bg-indigo-600'
                  )}
                  title={!offer.billingEmail ? (lang === 'fr' ? "Aucun email client renseigne" : "No client email provided") : (lang === 'fr' ? "Envoyer la facture par mail" : "Send invoice by email")}
                >
                  {isSendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  {isSendingEmail ? (lang === 'fr' ? 'Envoi...' : 'Sending...') : (lang === 'fr' ? 'Envoyer par mail' : 'Send by email')}
                </button>

                {/* Validate button */}
                <button
                  onClick={handleValidate}
                  disabled={isValidating}
                  className="flex items-center gap-2 bg-emerald-500 text-black rounded-full px-8 py-2.5 font-bold hover:bg-emerald-400 transition-colors disabled:opacity-50"
                >
                  {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {isValidating ? (lang === 'fr' ? 'Validation...' : 'Validating...') : (lang === 'fr' ? 'Valider la facture' : 'Validate invoice')}
                </button>
              </div>
            </div>

            {/* Split: Edit Left | Preview Right */}
            <div className="flex flex-col md:flex-row flex-1 min-h-0">
              {/* ─── LEFT: EDIT PANEL ─── */}
              <div className="w-full md:w-[340px] shrink-0 md:border-r border-b md:border-b-0 border-white/[0.08] overflow-y-auto p-4 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                  <Pencil className="h-3.5 w-3.5" />
                  {lang === 'fr' ? 'Modifier la facture' : 'Edit invoice'}
                </h3>

                {/* Title & Invoice number */}
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>{lang === 'fr' ? 'Titre du document' : 'Document title'}</label>
                    <input type="text" value={editableInvoiceTitle} onChange={e => setEditableInvoiceTitle(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>{lang === 'fr' ? 'Numero de facture' : 'Invoice number'}</label>
                    <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>{lang === 'fr' ? 'Echeance' : 'Due date'}</label>
                    <input type="text" value={editableEcheance} onChange={e => setEditableEcheance(e.target.value)} className={inputCls} placeholder={lang === 'fr' ? "A reception" : "Upon receipt"} />
                  </div>
                </div>

                {/* Commission Items */}
                {editableCommissionItems.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-purple-400">
                      {lang === 'fr' ? 'Lignes Commission' : 'Commission Lines'}
                    </p>
                    {editableCommissionItems.map(item => (
                      <div key={item.id} className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={item.description}
                            onChange={e => updateItem(item.id, 'description', e.target.value)}
                            className={cn(inputCls, 'text-xs flex-1')}
                            placeholder="Description"
                          />
                          <button onClick={() => removeItem(item.id)} className="text-red-400 hover:bg-red-400/10 rounded-lg p-1.5 transition-colors shrink-0">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={item.subtitle}
                          onChange={e => updateItem(item.id, 'subtitle', e.target.value)}
                          className={cn(inputCls, 'text-xs')}
                          placeholder={lang === 'fr' ? "Sous-titre / description (optionnel)" : "Subtitle / description (optional)"}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-white/40">{lang === 'fr' ? 'Qte' : 'Qty'}</label>
                            <input
                              type="number"
                              min={1}
                              value={item.count}
                              onChange={e => updateItem(item.id, 'count', parseInt(e.target.value) || 1)}
                              className={cn(inputCls, 'text-xs')}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-white/40">{lang === 'fr' ? 'Prix unitaire (EUR)' : 'Unit price (EUR)'}</label>
                            <input
                              type="number"
                              step="0.01"
                              min={0}
                              value={item.unitPrice}
                              onChange={e => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className={cn(inputCls, 'text-xs')}
                            />
                          </div>
                        </div>
                        <p className="text-[10px] text-right text-white/40 font-medium">
                          {lang === 'fr' ? 'Total' : 'Total'}: {formatCurrency(item.count * item.unitPrice)}
                        </p>
                      </div>
                    ))}
                    <button
                      onClick={() => addItem('commission')}
                      className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-purple-500/30 text-purple-400 text-xs font-medium py-2 hover:bg-purple-500/5 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" /> {lang === 'fr' ? 'Ajouter une ligne' : 'Add a line'}
                    </button>
                  </div>
                )}

                {/* Custom Items (always show add button) */}
                <div className="space-y-2">
                  {editableCustomItems.length > 0 && (
                    <input
                      type="text"
                      value={editableCustomSectionTitle}
                      onChange={e => setEditableCustomSectionTitle(e.target.value)}
                      className="text-xs font-bold uppercase tracking-widest text-white/40 bg-transparent border-b border-dashed border-white/[0.08] focus:border-emerald-500 outline-none pb-1 w-full"
                      placeholder={lang === 'fr' ? "Titre de la section" : "Section title"}
                    />
                  )}
                  {editableCustomItems.map(item => (
                    <div key={item.id} className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={item.description}
                          onChange={e => updateItem(item.id, 'description', e.target.value)}
                          className={cn(inputCls, 'text-xs flex-1')}
                          placeholder="Description"
                        />
                        <button onClick={() => removeItem(item.id)} className="text-red-400 hover:bg-red-400/10 rounded-lg p-1.5 transition-colors shrink-0">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={item.subtitle}
                        onChange={e => updateItem(item.id, 'subtitle', e.target.value)}
                        className={cn(inputCls, 'text-xs')}
                        placeholder={lang === 'fr' ? "Sous-titre / description (optionnel)" : "Subtitle / description (optional)"}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-white/40">{lang === 'fr' ? 'Qte' : 'Qty'}</label>
                          <input
                            type="number"
                            min={1}
                            value={item.count}
                            onChange={e => updateItem(item.id, 'count', parseInt(e.target.value) || 1)}
                            className={cn(inputCls, 'text-xs')}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-white/40">{lang === 'fr' ? 'Prix unitaire (EUR)' : 'Unit price (EUR)'}</label>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={item.unitPrice}
                            onChange={e => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className={cn(inputCls, 'text-xs')}
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-right text-white/40 font-medium">
                        {lang === 'fr' ? 'Total' : 'Total'}: {formatCurrency(item.count * item.unitPrice)}
                      </p>
                    </div>
                  ))}
                  <button
                    onClick={() => addItem('custom')}
                    className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/[0.08] text-white/40 text-xs font-medium py-2 hover:bg-white/10 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> {lang === 'fr' ? 'Ajouter un produit' : 'Add a product'}
                  </button>
                </div>

                {/* Stripe visibility toggle */}
                {generatedLink && (
                  <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3">
                    <label className="flex cursor-pointer items-center gap-3">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={showStripeOnInvoice}
                          onChange={(e) => setShowStripeOnInvoice(e.target.checked)}
                          className="peer sr-only"
                        />
                        <div className="h-5 w-9 rounded-full bg-white/10 peer-checked:bg-indigo-500 transition-colors"></div>
                        <div className="absolute left-1 top-1 h-3 w-3 rounded-full bg-white transition-transform peer-checked:translate-x-4"></div>
                      </div>
                      <span className="text-xs font-medium text-white">
                        {lang === 'fr' ? 'Afficher le paiement Stripe sur la facture' : 'Show Stripe payment on invoice'}
                      </span>
                    </label>
                  </div>
                )}

                {/* Late penalty text */}
                <div>
                  <label className={labelCls}>{lang === 'fr' ? 'Mentions penalites de retard' : 'Late penalty terms'}</label>
                  <textarea
                    value={editablePenaltyText}
                    onChange={e => setEditablePenaltyText(e.target.value)}
                    rows={3}
                    className={cn(inputCls, 'resize-none text-xs')}
                    placeholder={lang === 'fr' ? "Ex: En cas de retard de paiement..." : "E.g.: In case of late payment..."}
                  />
                </div>

                {/* Note / Footer */}
                <div>
                  <label className={labelCls}>{lang === 'fr' ? 'Note libre (bas de facture)' : 'Free note (invoice footer)'}</label>
                  <textarea
                    value={editableFooterNote}
                    onChange={e => setEditableFooterNote(e.target.value)}
                    rows={3}
                    className={cn(inputCls, 'resize-none')}
                    placeholder={lang === 'fr' ? "Ajouter une note, un commentaire..." : "Add a note, a comment..."}
                  />
                </div>

                {/* Totals summary */}
                <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">{lang === 'fr' ? 'Total HT' : 'Total excl. tax'}</span>
                    <span className="font-bold text-white">{formatCurrency(editableTotalHT)}</span>
                  </div>
                  {tvaApplicable && (
                    <div className="flex justify-between text-sm">
                      <span className="text-white/40">{lang === 'fr' ? 'TVA (20%)' : 'VAT (20%)'}</span>
                      <span className="font-bold text-white">{formatCurrency(editableTvaAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base pt-1 border-t border-purple-500/20">
                    <span className="font-bold text-white">{lang === 'fr' ? `Total ${tvaApplicable ? 'TTC' : ''}` : `Total ${tvaApplicable ? 'incl. tax' : ''}`}</span>
                    <span className="font-bold text-purple-400">{formatCurrency(editableTotalTTC)}</span>
                  </div>
                </div>
              </div>

              {/* ─── RIGHT: LIVE PREVIEW ─── */}
              <div className="overflow-y-auto overflow-x-auto bg-white flex-1 min-w-0">
                <div
                  id="invoice-preview-content"
                  ref={invoiceRef}
                  className="flex flex-col justify-between"
                  style={{
                    backgroundColor: 'white',
                    color: 'black',
                    width: '210mm',
                    minHeight: '297mm',
                    padding: '15mm',
                    boxSizing: 'border-box',
                    zoom: 0.62,
                  }}
                >
                  {/* Top content */}
                  <div>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h1 style={{ fontSize: '2.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>{editableInvoiceTitle}</h1>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '0.875rem', color: '#475569', margin: 0 }}>
                          {new Date().toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                    </div>

                    {/* Invoice Number */}
                    <div style={{ fontSize: '0.875rem', color: '#334155', marginTop: '0.5rem', marginBottom: '2rem' }}>
                      <p style={{ margin: 0 }}>
                        <span style={{ fontWeight: 600 }}>{lang === 'fr' ? 'Numero de facture:' : 'Invoice number:'}</span> {invoiceNumber}
                      </p>
                    </div>

                    {/* Emetteur / Destinataire */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                      <div>
                        <p style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.5rem' }}>{lang === 'fr' ? 'Emetteur' : 'Issuer'}</p>
                        <div style={{ fontSize: '0.875rem', color: '#0f172a' }}>
                          <p style={{ fontWeight: 700, margin: '0 0 0.25rem 0' }}>{issuerCompanyName || issuerName || (lang === 'fr' ? 'Emetteur' : 'Issuer')}</p>
                          {(issuerAddress || issuerCity || issuerZip || issuerCountry) && (
                            <div style={{ color: '#334155', marginBottom: '0.25rem' }}>
                              {issuerAddress && <p style={{ margin: 0 }}>{issuerAddress}</p>}
                              {(issuerZip || issuerCity) && <p style={{ margin: 0 }}>{issuerZip && `${issuerZip} `}{issuerCity}</p>}
                              {issuerCountry && <p style={{ margin: 0 }}>{issuerCountry}</p>}
                            </div>
                          )}
                          {issuerSiret && <p style={{ color: '#334155', margin: '0.125rem 0' }}><span style={{ fontWeight: 500 }}>SIRET:</span> {issuerSiret}</p>}
                          {issuerEmail && <p style={{ color: '#334155', margin: '0.125rem 0' }}><span style={{ fontWeight: 500 }}>Email:</span> {issuerEmail}</p>}
                          {issuerPhone && <p style={{ color: '#334155', margin: '0.125rem 0' }}><span style={{ fontWeight: 500 }}>Tel:</span> {issuerPhone}</p>}
                        </div>
                      </div>
                      <div>
                        <p style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.5rem' }}>{lang === 'fr' ? 'Destinataire' : 'Recipient'}</p>
                        <div style={{ fontSize: '0.875rem', color: '#0f172a' }}>
                          <p style={{ fontWeight: 700, margin: '0 0 0.25rem 0' }}>{offer.billingName || offer.company}</p>
                          <p style={{ fontWeight: 500, color: '#334155', margin: '0 0 0.25rem 0' }}>{offer.name}</p>
                          {(offer.billingAddress || offer.billingZip || offer.billingCity || offer.billingCountry) && (
                            <div style={{ color: '#334155', marginBottom: '0.25rem' }}>
                              {offer.billingAddress && <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{offer.billingAddress}</p>}
                              {(offer.billingZip || offer.billingCity) && <p style={{ margin: 0 }}>{offer.billingZip ? `${offer.billingZip} ` : ''}{offer.billingCity}</p>}
                              {offer.billingCountry && <p style={{ margin: 0 }}>{offer.billingCountry}</p>}
                            </div>
                          )}
                          {offer.siret && <p style={{ color: '#334155', margin: '0.125rem 0' }}><span style={{ fontWeight: 500 }}>SIRET:</span> {offer.siret}</p>}
                          {offer.billingEmail && <p style={{ color: '#334155', margin: '0.125rem 0' }}><span style={{ fontWeight: 500 }}>Email:</span> {offer.billingEmail}</p>}
                          {offer.billingPhone && <p style={{ color: '#334155', margin: '0.125rem 0' }}><span style={{ fontWeight: 500 }}>Tel:</span> {offer.billingPhone}</p>}
                        </div>
                      </div>
                    </div>

                    {/* Period */}
                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginBottom: '2rem' }}>
                      <p style={{ fontSize: '0.875rem', color: '#334155', margin: 0 }}>
                        <span style={{ fontWeight: 600 }}>{lang === 'fr' ? 'Periode:' : 'Period:'}</span>{' '}
                        {lang === 'fr'
                          ? `Du ${new Date(startDate).toLocaleDateString('fr-FR')} au ${new Date(endDate).toLocaleDateString('fr-FR')}`
                          : `From ${new Date(startDate).toLocaleDateString('en-US')} to ${new Date(endDate).toLocaleDateString('en-US')}`}
                      </p>
                    </div>

                    {/* Commission Items Table */}
                    {editableCommissionItems.length > 0 && (
                      <>
                        <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.5rem' }}>
                          Commission
                        </p>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid #0f172a', backgroundColor: '#f8fafc' }}>
                              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>Description</th>
                              <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>{lang === 'fr' ? 'Qte' : 'Qty'}</th>
                              <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>{lang === 'fr' ? 'Prix Unitaire' : 'Unit Price'}</th>
                              <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>{lang === 'fr' ? 'Total HT' : 'Total excl. tax'}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {editableCommissionItems.map(item => (
                              <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#0f172a' }}>
                                  <p style={{ fontWeight: 500, margin: 0 }}>{item.description}</p>
                                  {item.subtitle && <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>{item.subtitle}</p>}
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'center', fontSize: '0.875rem', color: '#0f172a' }}>{item.count}</td>
                                <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', color: '#0f172a' }}>{formatCurrency(item.unitPrice)}</td>
                                <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>{formatCurrency(item.count * item.unitPrice)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}

                    {/* Custom Items Table */}
                    {editableCustomItems.length > 0 && (
                      <>
                        <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.5rem' }}>
                          {editableCustomSectionTitle}
                        </p>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid #0f172a', backgroundColor: '#f8fafc' }}>
                              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>Description</th>
                              <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>{lang === 'fr' ? 'Qte' : 'Qty'}</th>
                              <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>{lang === 'fr' ? 'Prix Unitaire' : 'Unit Price'}</th>
                              <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>{lang === 'fr' ? 'Total HT' : 'Total excl. tax'}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {editableCustomItems.map(item => (
                              <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#0f172a' }}>
                                  <p style={{ fontWeight: 500, margin: 0 }}>{item.description}</p>
                                  {item.subtitle && <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>{item.subtitle}</p>}
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'center', fontSize: '0.875rem', color: '#0f172a' }}>{item.count}</td>
                                <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', color: '#0f172a' }}>{formatCurrency(item.unitPrice)}</td>
                                <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>{formatCurrency(item.count * item.unitPrice)}</td>
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
                          <span style={{ color: '#334155' }}>{lang === 'fr' ? 'Total HT' : 'Total excl. tax'}</span>
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>{formatCurrency(editableTotalHT)}</span>
                        </div>
                        {tvaApplicable && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                            <span style={{ color: '#334155' }}>{lang === 'fr' ? 'TVA (20%)' : 'VAT (20%)'}</span>
                            <span style={{ fontWeight: 600, color: '#0f172a' }}>{formatCurrency(editableTvaAmount)}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0f172a', paddingTop: '0.5rem', fontSize: '1.125rem' }}>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>{lang === 'fr' ? `Total ${tvaApplicable ? 'TTC' : ''}` : `Total ${tvaApplicable ? 'incl. tax' : ''}`}</span>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>{formatCurrency(editableTotalTTC)}</span>
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
                          {lang === 'fr' ? 'Conditions de reglement' : 'Payment terms'}
                        </p>
                        <div style={{ fontSize: '0.875rem', color: '#334155' }}>
                          <p style={{ margin: '0.25rem 0' }}>
                            <span style={{ fontWeight: 500 }}>{lang === 'fr' ? 'Echeance:' : 'Due date:'}</span> {editableEcheance}
                          </p>
                          <p style={{ margin: '0.25rem 0' }}>
                            <span style={{ fontWeight: 500 }}>{lang === 'fr' ? 'Mode de reglement:' : 'Payment method:'}</span> {getPaymentMethodLabel()}
                          </p>

                          {paymentMethod === 'virement' && (
                            <div style={{ marginTop: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', backgroundColor: '#f8fafc', padding: '0.75rem' }}>
                              <p style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: '#475569', marginBottom: '0.5rem' }}>{lang === 'fr' ? 'Coordonnees bancaires' : 'Bank details'}</p>
                              <div style={{ fontSize: '0.75rem' }}>
                                <p style={{ margin: '0.125rem 0' }}><span style={{ fontWeight: 500 }}>IBAN:</span> {iban}</p>
                                <p style={{ margin: '0.125rem 0' }}><span style={{ fontWeight: 500 }}>BIC:</span> {bic}</p>
                                <p style={{ margin: '0.125rem 0' }}><span style={{ fontWeight: 500 }}>{lang === 'fr' ? 'Titulaire:' : 'Account holder:'}</span> {accountHolder}</p>
                              </div>
                            </div>
                          )}
                          {paymentMethod === 'paypal' && <p style={{ margin: '0.25rem 0' }}><span style={{ fontWeight: 500 }}>PayPal:</span> {paypalEmail}</p>}
                          {paymentMethod === 'revolut' && <p style={{ margin: '0.25rem 0' }}><span style={{ fontWeight: 500 }}>Revolut:</span> {revtag}</p>}
                          {paymentMethod === 'stripe' && stripeLink && (
                            <p style={{ margin: '0.25rem 0', wordBreak: 'break-all' }}>
                              <span style={{ fontWeight: 500 }}>{lang === 'fr' ? 'Lien Stripe:' : 'Stripe Link:'}</span>{' '}
                              <a href={stripeLink} style={{ color: '#2563eb', textDecoration: 'underline' }}>{stripeLink}</a>
                            </p>
                          )}

                          {!tvaApplicable && (
                            <div style={{ marginTop: '1rem', borderLeft: '4px solid #a855f7', backgroundColor: '#faf5ff', padding: '0.75rem', borderRadius: '0.25rem' }}>
                              <p style={{ fontSize: '0.75rem', fontWeight: 600, fontStyle: 'italic', color: '#0f172a', margin: 0 }}>
                                {lang === 'fr' ? 'TVA non applicable, art. 293 B du CGI' : 'VAT not applicable, art. 293 B of the French Tax Code'}
                              </p>
                            </div>
                          )}

                          {editablePenaltyText && (
                            <div style={{ marginTop: '0.75rem', fontSize: '0.6875rem', color: '#64748b', whiteSpace: 'pre-wrap' }}>
                              {editablePenaltyText}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right - Stripe QR Code */}
                      {showStripeOnInvoice && generatedLink && qrCodeUrl && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '0.25rem' }}>{lang === 'fr' ? 'Payer en ligne' : 'Pay online'}</p>
                            <p style={{ fontSize: '0.625rem', color: '#94a3b8', marginBottom: '0.5rem', maxWidth: '120px' }}>
                              {lang === 'fr' ? 'Scannez pour regler par CB instantanement' : 'Scan to pay by card instantly'}
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
                              {lang === 'fr' ? 'Payer maintenant' : 'Pay now'} &rarr;
                            </a>
                          </div>
                          <img src={qrCodeUrl} alt={lang === 'fr' ? "QR Code Paiement" : "Payment QR Code"} style={{ width: '80px', height: '80px' }} />
                        </div>
                      )}
                    </div>

                    {/* Custom note */}
                    {editableFooterNote && (
                      <div style={{ marginTop: '1rem', fontSize: '0.8125rem', color: '#334155', whiteSpace: 'pre-wrap' }}>
                        {editableFooterNote}
                      </div>
                    )}

                    <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                      <p style={{ fontSize: '0.625rem', color: '#94a3b8', margin: 0 }}>
                        {lang === 'fr' ? 'Facture generee automatiquement par CloseOS' : 'Invoice automatically generated by CloseOS'}
                      </p>
                    </div>
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
