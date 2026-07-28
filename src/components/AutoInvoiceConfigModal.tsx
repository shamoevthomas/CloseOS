import { useState, useEffect } from 'react'
import { X, Zap, Calendar, Building2, Wallet, Mail, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Offer } from '../contexts/OffersContext'
import { useLanguage } from '../contexts/LanguageContext'

interface AutoInvoiceConfig {
    id?: string
    offer_id: number
    enabled: boolean
    day_of_month: number
    issuer_profile_id: string | null
    payment_method_id: string | null
    send_copy_to_user: boolean
    tva_applicable: boolean
}

interface IssuerProfile {
    id: string
    name: string
    company_name: string
}

interface PaymentMethod {
    id: string
    name: string
    type: string
}

interface AutoInvoiceConfigModalProps {
    isOpen: boolean
    onClose: () => void
    offers: Offer[]
}

export function AutoInvoiceConfigModal({ isOpen, onClose, offers }: AutoInvoiceConfigModalProps) {
    const { lang } = useLanguage()
    const [configs, setConfigs] = useState<Record<number, AutoInvoiceConfig>>({})
    const [issuerProfiles, setIssuerProfiles] = useState<IssuerProfile[]>([])
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState<number | null>(null)
    const [selectedOfferId, setSelectedOfferId] = useState<number | null>(null)

    useEffect(() => {
        if (isOpen) {
            loadData()
        }
    }, [isOpen])

    useEffect(() => {
        if (offers.length > 0 && selectedOfferId === null) {
            setSelectedOfferId(offers[0].id)
        }
    }, [offers])

    const loadData = async () => {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Load configs, profiles, and payment methods in parallel
            const [configsRes, profilesRes, methodsRes] = await Promise.all([
                supabase.from('auto_invoice_configs').select('*').eq('user_id', user.id),
                supabase.from('issuer_profiles').select('id, name, company_name').eq('user_id', user.id),
                supabase.from('payment_methods').select('id, name, type').eq('user_id', user.id),
            ])

            if (configsRes.data) {
                const map: Record<number, AutoInvoiceConfig> = {}
                configsRes.data.forEach((c: any) => {
                    map[c.offer_id] = {
                        id: c.id,
                        offer_id: c.offer_id,
                        enabled: c.enabled,
                        day_of_month: c.day_of_month,
                        issuer_profile_id: c.issuer_profile_id,
                        payment_method_id: c.payment_method_id,
                        send_copy_to_user: c.send_copy_to_user,
                        tva_applicable: c.tva_applicable,
                    }
                })
                setConfigs(map)
            }

            if (profilesRes.data) setIssuerProfiles(profilesRes.data)
            if (methodsRes.data) setPaymentMethods(methodsRes.data)
        } catch (err) {
            console.error('Erreur chargement config auto-facture:', err)
        } finally {
            setLoading(false)
        }
    }

    const getConfig = (offerId: number): AutoInvoiceConfig => {
        return configs[offerId] || {
            offer_id: offerId,
            enabled: false,
            day_of_month: 1,
            issuer_profile_id: null,
            payment_method_id: null,
            send_copy_to_user: false,
            tva_applicable: false,
        }
    }

    const updateConfig = (offerId: number, updates: Partial<AutoInvoiceConfig>) => {
        setConfigs(prev => ({
            ...prev,
            [offerId]: { ...getConfig(offerId), ...updates }
        }))
    }

    const saveConfig = async (offerId: number) => {
        setSaving(offerId)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const config = getConfig(offerId)
            const payload = {
                user_id: user.id,
                offer_id: offerId,
                enabled: config.enabled,
                day_of_month: config.day_of_month,
                issuer_profile_id: config.issuer_profile_id,
                payment_method_id: config.payment_method_id,
                send_copy_to_user: config.send_copy_to_user,
                tva_applicable: config.tva_applicable,
                updated_at: new Date().toISOString(),
            }

            if (config.id) {
                // Update existing
                const { error } = await supabase
                    .from('auto_invoice_configs')
                    .update(payload)
                    .eq('id', config.id)
                if (error) throw error
            } else {
                // Insert new
                const { data, error } = await supabase
                    .from('auto_invoice_configs')
                    .upsert(payload, { onConflict: 'user_id,offer_id' })
                    .select()
                if (error) throw error
                if (data && data[0]) {
                    updateConfig(offerId, { id: data[0].id })
                }
            }

            alert(lang === 'fr' ? 'Configuration sauvegardée !' : 'Configuration saved!')
        } catch (err) {
            console.error('Erreur sauvegarde:', err)
            alert(lang === 'fr' ? 'Erreur lors de la sauvegarde.' : 'Error saving.')
        } finally {
            setSaving(null)
        }
    }

    if (!isOpen) return null

    const activeOffers = offers.filter(o => o.status === 'active')
    const currentConfig = selectedOfferId ? getConfig(selectedOfferId) : null
    const selectedOffer = activeOffers.find(o => o.id === selectedOfferId)

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#1a1a1a] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_14px_34px_-16px_rgba(15,23,42,0.10)] ring-1 ring-slate-200 z-[101]">
                {/* Close */}
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 z-10 rounded-full p-2 text-slate-400 dark:text-neutral-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="p-8">
                    {/* HEADER */}
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/20">
                            <Zap className="h-6 w-6 text-amber-600" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{lang === 'fr' ? 'Facturation Automatique' : 'Automatic Invoicing'}</h2>
                            <p className="text-sm text-slate-400 dark:text-neutral-500">{lang === 'fr' ? "Configurez la génération et l'envoi automatique par offre" : 'Configure automatic generation and sending per offer'}</p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-sky-600 dark:text-sky-400" />
                        </div>
                    ) : activeOffers.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-slate-400 dark:text-neutral-500">{lang === 'fr' ? "Aucune offre active. Créez d'abord une offre." : 'No active offers. Create an offer first.'}</p>
                        </div>
                    ) : (
                        <>
                            {/* OFFER SELECTOR */}
                            <div className="flex gap-2 overflow-x-auto pb-4 mb-6">
                                {activeOffers.map(offer => (
                                    <button
                                        key={offer.id}
                                        onClick={() => setSelectedOfferId(offer.id)}
                                        className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition-all ${selectedOfferId === offer.id
                                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 dark:text-white shadow-lg shadow-amber-500/20'
                                            : 'border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-400 dark:text-neutral-500 hover:bg-slate-100 hover:text-slate-900'
                                            }`}
                                    >
                                        {offer.name}
                                    </button>
                                ))}
                            </div>

                            {currentConfig && selectedOffer && (
                                <div className="space-y-6">
                                    {/* MASTER SWITCH */}
                                    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 backdrop-blur-2xl p-5">
                                        <label className="flex cursor-pointer items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Zap className="h-5 w-5 text-amber-600" />
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{lang === 'fr' ? 'Activer la facturation automatique' : 'Enable automatic invoicing'}</p>
                                                    <p className="text-xs text-slate-400 dark:text-neutral-500 mt-0.5">
                                                        {lang === 'fr' ? 'Génère et envoie automatiquement une facture chaque mois' : 'Automatically generates and sends an invoice each month'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="relative">
                                                <input
                                                    type="checkbox"
                                                    checked={currentConfig.enabled}
                                                    onChange={(e) => updateConfig(selectedOfferId!, { enabled: e.target.checked })}
                                                    className="peer sr-only"
                                                />
                                                <div className="h-6 w-11 rounded-full bg-slate-100 dark:bg-white/10 peer-checked:bg-amber-500 transition-colors"></div>
                                                <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white dark:bg-[#1a1a1a] transition-transform peer-checked:translate-x-5"></div>
                                            </div>
                                        </label>
                                    </div>

                                    {/* CONFIG FIELDS  — shown only when enabled */}
                                    {currentConfig.enabled && (
                                        <div className="space-y-5 animate-in fade-in duration-200">

                                            {/* DAY OF MONTH */}
                                            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 backdrop-blur-2xl p-5">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Calendar className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                                                    <label className="text-sm font-bold text-slate-900 dark:text-white">{lang === 'fr' ? 'Jour de génération' : 'Generation day'}</label>
                                                </div>
                                                <select
                                                    value={currentConfig.day_of_month}
                                                    onChange={(e) => updateConfig(selectedOfferId!, { day_of_month: parseInt(e.target.value) })}
                                                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:border-sky-500 focus:outline-none"
                                                >
                                                    {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                                                        <option key={day} value={day}>
                                                            {lang === 'fr' ? `Le ${day}${day === 1 ? 'er' : ''} du mois` : `${day}${day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'} of the month`}
                                                        </option>
                                                    ))}
                                                </select>
                                                <p className="text-xs text-slate-400 dark:text-neutral-500 mt-2">
                                                    {lang === 'fr' ? 'La facture couvrira la période du mois précédent' : 'The invoice will cover the previous month period'}
                                                </p>
                                            </div>

                                            {/* ISSUER PROFILE */}
                                            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 backdrop-blur-2xl p-5">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Building2 className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                                                    <label className="text-sm font-bold text-slate-900 dark:text-white">{lang === 'fr' ? 'Profil Émetteur' : 'Issuer Profile'}</label>
                                                </div>
                                                {issuerProfiles.length > 0 ? (
                                                    <select
                                                        value={currentConfig.issuer_profile_id || ''}
                                                        onChange={(e) => updateConfig(selectedOfferId!, { issuer_profile_id: e.target.value || null })}
                                                        className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:border-sky-500 focus:outline-none"
                                                    >
                                                        <option value="">{lang === 'fr' ? '— Sélectionner un profil —' : '— Select a profile —'}</option>
                                                        {issuerProfiles.map(p => (
                                                            <option key={p.id} value={p.id}>{p.name} - {p.company_name}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <p className="text-xs text-amber-600">
                                                        {lang === 'fr' ? '⚠️ Aucun profil émetteur enregistré. Créez-en un via le bouton "Infos Émetteur".' : '⚠️ No issuer profile saved. Create one via the "Issuer Info" button.'}
                                                    </p>
                                                )}
                                            </div>

                                            {/* PAYMENT METHOD */}
                                            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 backdrop-blur-2xl p-5">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Wallet className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                                                    <label className="text-sm font-bold text-slate-900 dark:text-white">{lang === 'fr' ? 'Moyen de Paiement' : 'Payment Method'}</label>
                                                </div>
                                                {paymentMethods.length > 0 ? (
                                                    <select
                                                        value={currentConfig.payment_method_id || ''}
                                                        onChange={(e) => updateConfig(selectedOfferId!, { payment_method_id: e.target.value || null })}
                                                        className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:border-sky-500 focus:outline-none"
                                                    >
                                                        <option value="">{lang === 'fr' ? '— Sélectionner un moyen —' : '— Select a method —'}</option>
                                                        {paymentMethods.map(m => (
                                                            <option key={m.id} value={m.id}>{m.name} ({m.type})</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <p className="text-xs text-amber-600">
                                                        {lang === 'fr' ? '⚠️ Aucun moyen de paiement enregistré. Créez-en un via le bouton "Moyens de Paiement".' : '⚠️ No payment method saved. Create one via the "Payment Methods" button.'}
                                                    </p>
                                                )}
                                            </div>

                                            {/* TVA TOGGLE */}
                                            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 backdrop-blur-2xl p-5">
                                                <label className="flex cursor-pointer items-center justify-between">
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{lang === 'fr' ? 'TVA applicable (20%)' : 'VAT applicable (20%)'}</p>
                                                        <p className="text-xs text-slate-400 dark:text-neutral-500 mt-0.5">{lang === 'fr' ? 'Appliquer la TVA sur les factures générées' : 'Apply VAT on generated invoices'}</p>
                                                    </div>
                                                    <div className="relative">
                                                        <input
                                                            type="checkbox"
                                                            checked={currentConfig.tva_applicable}
                                                            onChange={(e) => updateConfig(selectedOfferId!, { tva_applicable: e.target.checked })}
                                                            className="peer sr-only"
                                                        />
                                                        <div className="h-6 w-11 rounded-full bg-slate-100 dark:bg-white/10 peer-checked:bg-sky-600 transition-colors"></div>
                                                        <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white dark:bg-[#1a1a1a] transition-transform peer-checked:translate-x-5"></div>
                                                    </div>
                                                </label>
                                            </div>

                                            {/* SEND COPY SWITCH */}
                                            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 backdrop-blur-2xl p-5">
                                                <label className="flex cursor-pointer items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <Mail className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-900 dark:text-white">{lang === 'fr' ? "M'envoyer une copie par mail" : 'Send me a copy by email'}</p>
                                                            <p className="text-xs text-slate-400 dark:text-neutral-500 mt-0.5">
                                                                {lang === 'fr' ? "Recevez une copie de chaque facture à votre adresse email d'inscription" : 'Receive a copy of each invoice to your registration email'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="relative">
                                                        <input
                                                            type="checkbox"
                                                            checked={currentConfig.send_copy_to_user}
                                                            onChange={(e) => updateConfig(selectedOfferId!, { send_copy_to_user: e.target.checked })}
                                                            className="peer sr-only"
                                                        />
                                                        <div className="h-6 w-11 rounded-full bg-slate-100 dark:bg-white/10 peer-checked:bg-sky-600 transition-colors"></div>
                                                        <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white dark:bg-[#1a1a1a] transition-transform peer-checked:translate-x-5"></div>
                                                    </div>
                                                </label>
                                            </div>

                                            {/* INFO BOX */}
                                            {!selectedOffer.billingEmail && (
                                                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4">
                                                    <p className="text-sm text-rose-300">
                                                        {lang === 'fr'
                                                          ? <>⚠️ <strong>Aucun email de facturation</strong> configuré pour cette offre. Ajoutez un email dans les détails de l'offre (onglet Facturation) pour que la facture soit envoyée à l'infopreneur.</>
                                                          : <>⚠️ <strong>No billing email</strong> configured for this offer. Add an email in the offer details (Billing tab) so the invoice is sent to the client.</>}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* SAVE BUTTON */}
                                    <button
                                        onClick={() => saveConfig(selectedOfferId!)}
                                        disabled={saving === selectedOfferId}
                                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3.5 text-sm font-bold text-slate-900 dark:text-white shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] hover:shadow-amber-500/30 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {saving === selectedOfferId ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                {lang === 'fr' ? 'Sauvegarde...' : 'Saving...'}
                                            </>
                                        ) : (
                                            <>
                                                <Zap className="h-4 w-4" />
                                                {lang === 'fr' ? 'Sauvegarder la configuration' : 'Save configuration'}
                                            </>
                                        )}
                                    </button>

                                    {/* STATUS SUMMARY */}
                                    {currentConfig.enabled && (
                                        <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-4">
                                            <p className="text-sm text-sky-700 dark:text-sky-400">
                                                {lang === 'fr'
                                                  ? <>✅ Une facture sera générée automatiquement le <strong>{currentConfig.day_of_month}{currentConfig.day_of_month === 1 ? 'er' : ''}</strong> de chaque mois{selectedOffer.billingEmail && <> et envoyée à <strong>{selectedOffer.billingEmail}</strong></>}{currentConfig.send_copy_to_user && <> + une copie pour vous</>}.</>
                                                  : <>✅ An invoice will be generated automatically on the <strong>{currentConfig.day_of_month}{currentConfig.day_of_month === 1 ? 'st' : currentConfig.day_of_month === 2 ? 'nd' : currentConfig.day_of_month === 3 ? 'rd' : 'th'}</strong> of each month{selectedOffer.billingEmail && <> and sent to <strong>{selectedOffer.billingEmail}</strong></>}{currentConfig.send_copy_to_user && <> + a copy for you</>}.</>}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
