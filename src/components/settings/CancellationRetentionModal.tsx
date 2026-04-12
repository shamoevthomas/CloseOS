import { useState, useEffect } from 'react';
import { X, Calendar, LogOut, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { getCalApi } from "@calcom/embed-react";

interface CancellationRetentionModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CancellationRetentionModal({ isOpen, onClose }: CancellationRetentionModalProps) {
    const { user } = useAuth();
    const { lang } = useLanguage();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        (async function () {
            const cal = await getCalApi({ namespace: "demande-d-annulation-closeos" });
            cal("ui", { hideEventTypeDetails: true, layout: "month_view" });
        })();
    }, []);

    if (!isOpen) return null;

    const handleConfirmCancellation = async () => {
        if (!user) return;

        setLoading(true);
        try {
            const response = await fetch('/api/cancel-subscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || (lang === 'fr' ? 'Erreur lors de l\'annulation' : 'Error during cancellation'));
            }

            // Show success message and close
            alert(lang === 'fr' ? 'Votre abonnement sera annulé à la fin de votre période de facturation.' : 'Your subscription will be cancelled at the end of your billing period.');
            onClose();
            window.location.reload(); // Refresh to update UI
        } catch (error: any) {
            console.error('Cancellation error:', error);
            alert(error.message || (lang === 'fr' ? 'Erreur lors de l\'annulation' : 'Error during cancellation'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-white/[0.08] bg-[#1a1a1a] shadow-2xl relative overflow-hidden">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full bg-white/[0.03] border border-white/[0.08] hover:bg-white/10 text-white/40 hover:text-white transition-colors z-10"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="p-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-red-600 to-orange-500 text-white shadow-lg shadow-red-500/20">
                            <LogOut className="h-8 w-8" />
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-3">{lang === 'fr' ? 'Avant de partir...' : 'Before you go...'}</h2>
                        <p className="text-white/40 text-lg">
                            {lang === 'fr' ? 'Nous aimerions comprendre ce qui ne vous convient pas.' : "We'd like to understand what didn't work for you."}
                        </p>
                    </div>

                    {/* Content */}
                    <div className="space-y-6 mb-8">
                        <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                            <p className="text-white font-medium mb-2">
                                {lang === 'fr' ? '💬 Discutons-en ensemble' : "💬 Let's discuss it together"}
                            </p>
                            <p className="text-white/40 text-sm">
                                {lang === 'fr' ? 'Prenez 15 minutes avec notre équipe pour nous expliquer vos besoins. Nous trouverons peut-être une solution ensemble !' : 'Take 15 minutes with our team to explain your needs. We might find a solution together!'}
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <button
                                data-cal-namespace="demande-d-annulation-closeos"
                                data-cal-link="thomas-sh-ipdmni/demande-d-annulation-closeos"
                                data-cal-config='{"layout":"month_view","useSlotsViewOnSmallScreen":"true"}'
                                disabled={loading}
                                className="w-full px-6 py-4 bg-emerald-500 hover:bg-emerald-400 text-black rounded-full font-bold transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                <Calendar className="h-5 w-5" />
                                {lang === 'fr' ? 'Je prends rendez-vous avant de partir' : 'I\'ll book an appointment before leaving'}
                            </button>

                            <button
                                onClick={handleConfirmCancellation}
                                disabled={loading}
                                className="w-full px-6 py-4 bg-white/[0.03] hover:bg-white/10 text-white/60 hover:text-white rounded-full font-medium transition-all border border-white/[0.08] flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        {lang === 'fr' ? 'Annulation en cours...' : 'Cancelling...'}
                                    </>
                                ) : (
                                    <>
                                        <LogOut className="h-5 w-5" />
                                        {lang === 'fr' ? 'Je préfère partir' : 'I prefer to leave'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Footer note */}
                    <p className="text-center text-sm text-white/40">
                        {lang === 'fr' ? "Votre abonnement restera actif jusqu'à la fin de votre période de facturation" : 'Your subscription will remain active until the end of your billing period'}
                    </p>
                </div>
            </div>
        </div>
    );
}
