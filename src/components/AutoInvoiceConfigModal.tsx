import { useState, useEffect } from 'react'
import { X, Zap, Calendar, Building2, Wallet, Mail, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Offer } from '../contexts/OffersContext'

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

            alert('Configuration sauvegardée !')
        } catch (err) {
            console.error('Erreur sauvegarde:', err)
            alert('Erreur lors de la sauvegarde.')
        } finally {
            setSaving(null)
        }
    }

    if (!isOpen) return null

    const activeOffers = offers.filter(o => o.status === 'active')
    const currentConfig = selectedOfferId ? getConfig(selectedOfferId) : null
    const selectedOffer = activeOffers.find(o => o.id === selectedOfferId)

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 shadow-2xl ring-1 ring-slate-800 z-[101]">
                {/* Close */}
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 z-10 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="p-8">
                    {/* HEADER */}
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/20">
                            <Zap className="h-6 w-6 text-amber-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">Facturation Automatique</h2>
                            <p className="text-sm text-slate-400">Configurez la génération et l'envoi automatique par offre</p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                        </div>
                    ) : activeOffers.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-slate-400">Aucune offre active. Créez d'abord une offre.</p>
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
                                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20'
                                            : 'border border-white/10 bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-white'
                                            }`}
                                    >
                                        {offer.name}
                                    </button>
                                ))}
                            </div>

                            {currentConfig && selectedOffer && (
                                <div className="space-y-6">
                                    {/* MASTER SWITCH */}
                                    <div className="rounded-xl border border-white/10 bg-slate-800/30 p-5">
                                        <label className="flex cursor-pointer items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Zap className="h-5 w-5 text-amber-400" />
                                                <div>
                                                    <p className="text-sm font-bold text-white">Activer la facturation automatique</p>
                                                    <p className="text-xs text-slate-400 mt-0.5">
                                                        Génère et envoie automatiquement une facture chaque mois
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
                                                <div className="h-6 w-11 rounded-full bg-slate-700 peer-checked:bg-amber-500 transition-colors"></div>
                                                <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5"></div>
                                            </div>
                                        </label>
                                    </div>

                                    {/* CONFIG FIELDS  — shown only when enabled */}
                                    {currentConfig.enabled && (
                                        <div className="space-y-5 animate-in fade-in duration-200">

                                            {/* DAY OF MONTH */}
                                            <div className="rounded-xl border border-white/10 bg-slate-800/30 p-5">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Calendar className="h-4 w-4 text-purple-400" />
                                                    <label className="text-sm font-bold text-white">Jour de génération</label>
                                                </div>
                                                <select
                                                    value={currentConfig.day_of_month}
                                                    onChange={(e) => updateConfig(selectedOfferId!, { day_of_month: parseInt(e.target.value) })}
                                                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white focus:border-purple-500 focus:outline-none"
                                                >
                                                    {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                                                        <option key={day} value={day}>
                                                            Le {day}{day === 1 ? 'er' : ''} du mois
                                                        </option>
                                                    ))}
                                                </select>
                                                <p className="text-xs text-slate-500 mt-2">
                                                    La facture couvrira la période du mois précédent
                                                </p>
                                            </div>

                                            {/* ISSUER PROFILE */}
                                            <div className="rounded-xl border border-white/10 bg-slate-800/30 p-5">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Building2 className="h-4 w-4 text-blue-400" />
                                                    <label className="text-sm font-bold text-white">Profil Émetteur</label>
                                                </div>
                                                {issuerProfiles.length > 0 ? (
                                                    <select
                                                        value={currentConfig.issuer_profile_id || ''}
                                                        onChange={(e) => updateConfig(selectedOfferId!, { issuer_profile_id: e.target.value || null })}
                                                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white focus:border-purple-500 focus:outline-none"
                                                    >
                                                        <option value="">— Sélectionner un profil —</option>
                                                        {issuerProfiles.map(p => (
                                                            <option key={p.id} value={p.id}>{p.name} - {p.company_name}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <p className="text-xs text-amber-400">
                                                        ⚠️ Aucun profil émetteur enregistré. Créez-en un via le bouton "Infos Émetteur".
                                                    </p>
                                                )}
                                            </div>

                                            {/* PAYMENT METHOD */}
                                            <div className="rounded-xl border border-white/10 bg-slate-800/30 p-5">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Wallet className="h-4 w-4 text-emerald-400" />
                                                    <label className="text-sm font-bold text-white">Moyen de Paiement</label>
                                                </div>
                                                {paymentMethods.length > 0 ? (
                                                    <select
                                                        value={currentConfig.payment_method_id || ''}
                                                        onChange={(e) => updateConfig(selectedOfferId!, { payment_method_id: e.target.value || null })}
                                                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white focus:border-purple-500 focus:outline-none"
                                                    >
                                                        <option value="">— Sélectionner un moyen —</option>
                                                        {paymentMethods.map(m => (
                                                            <option key={m.id} value={m.id}>{m.name} ({m.type})</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <p className="text-xs text-amber-400">
                                                        ⚠️ Aucun moyen de paiement enregistré. Créez-en un via le bouton "Moyens de Paiement".
                                                    </p>
                                                )}
                                            </div>

                                            {/* TVA TOGGLE */}
                                            <div className="rounded-xl border border-white/10 bg-slate-800/30 p-5">
                                                <label className="flex cursor-pointer items-center justify-between">
                                                    <div>
                                                        <p className="text-sm font-bold text-white">TVA applicable (20%)</p>
                                                        <p className="text-xs text-slate-400 mt-0.5">Appliquer la TVA sur les factures générées</p>
                                                    </div>
                                                    <div className="relative">
                                                        <input
                                                            type="checkbox"
                                                            checked={currentConfig.tva_applicable}
                                                            onChange={(e) => updateConfig(selectedOfferId!, { tva_applicable: e.target.checked })}
                                                            className="peer sr-only"
                                                        />
                                                        <div className="h-6 w-11 rounded-full bg-slate-700 peer-checked:bg-purple-500 transition-colors"></div>
                                                        <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5"></div>
                                                    </div>
                                                </label>
                                            </div>

                                            {/* SEND COPY SWITCH */}
                                            <div className="rounded-xl border border-white/10 bg-slate-800/30 p-5">
                                                <label className="flex cursor-pointer items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <Mail className="h-5 w-5 text-cyan-400" />
                                                        <div>
                                                            <p className="text-sm font-bold text-white">M'envoyer une copie par mail</p>
                                                            <p className="text-xs text-slate-400 mt-0.5">
                                                                Recevez une copie de chaque facture à votre adresse email d'inscription
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
                                                        <div className="h-6 w-11 rounded-full bg-slate-700 peer-checked:bg-cyan-500 transition-colors"></div>
                                                        <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5"></div>
                                                    </div>
                                                </label>
                                            </div>

                                            {/* INFO BOX */}
                                            {!selectedOffer.billingEmail && (
                                                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4">
                                                    <p className="text-sm text-rose-300">
                                                        ⚠️ <strong>Aucun email de facturation</strong> configuré pour cette offre.
                                                        Ajoutez un email dans les détails de l'offre (onglet Facturation) pour que la facture soit envoyée à l'infopreneur.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* SAVE BUTTON */}
                                    <button
                                        onClick={() => saveConfig(selectedOfferId!)}
                                        disabled={saving === selectedOfferId}
                                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] hover:shadow-amber-500/30 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {saving === selectedOfferId ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Sauvegarde...
                                            </>
                                        ) : (
                                            <>
                                                <Zap className="h-4 w-4" />
                                                Sauvegarder la configuration
                                            </>
                                        )}
                                    </button>

                                    {/* STATUS SUMMARY */}
                                    {currentConfig.enabled && (
                                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                                            <p className="text-sm text-emerald-300">
                                                ✅ Une facture sera générée automatiquement le <strong>{currentConfig.day_of_month}{currentConfig.day_of_month === 1 ? 'er' : ''}</strong> de chaque mois
                                                {selectedOffer.billingEmail && (
                                                    <> et envoyée à <strong>{selectedOffer.billingEmail}</strong></>
                                                )}
                                                {currentConfig.send_copy_to_user && <> + une copie pour vous</>}
                                                .
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
