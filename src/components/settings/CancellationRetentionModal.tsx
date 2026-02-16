import { useState, useEffect } from 'react';
import { X, Calendar, LogOut, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getCalApi } from "@calcom/embed-react";

interface CancellationRetentionModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CancellationRetentionModal({ isOpen, onClose }: CancellationRetentionModalProps) {
    const { user } = useAuth();
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
                throw new Error(data.error || 'Erreur lors de l\'annulation');
            }

            // Show success message and close
            alert('Votre abonnement sera annulé à la fin de votre période de facturation.');
            onClose();
            window.location.reload(); // Refresh to update UI
        } catch (error: any) {
            console.error('Cancellation error:', error);
            alert(error.message || 'Erreur lors de l\'annulation');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1121] shadow-2xl relative overflow-hidden">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors z-10"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="p-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-red-600 to-orange-500 text-white shadow-lg shadow-red-500/20">
                            <LogOut className="h-8 w-8" />
                        </div>
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">Avant de partir...</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-lg">
                            Nous aimerions comprendre ce qui ne vous convient pas.
                        </p>
                    </div>

                    {/* Content */}
                    <div className="space-y-6 mb-8">
                        <div className="p-6 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
                            <p className="text-slate-900 dark:text-white font-medium mb-2">
                                💬 Discutons-en ensemble
                            </p>
                            <p className="text-slate-600 dark:text-slate-400 text-sm">
                                Prenez 15 minutes avec notre équipe pour nous expliquer vos besoins.
                                Nous trouverons peut-être une solution ensemble !
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <button
                                data-cal-namespace="demande-d-annulation-closeos"
                                data-cal-link="thomas-sh-ipdmni/demande-d-annulation-closeos"
                                data-cal-config='{"layout":"month_view","useSlotsViewOnSmallScreen":"true"}'
                                disabled={loading}
                                className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                <Calendar className="h-5 w-5" />
                                Je prends rendez-vous avant de partir
                            </button>

                            <button
                                onClick={handleConfirmCancellation}
                                disabled={loading}
                                className="w-full px-6 py-4 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl font-medium transition-all border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        Annulation en cours...
                                    </>
                                ) : (
                                    <>
                                        <LogOut className="h-5 w-5" />
                                        Je préfère partir
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Footer note */}
                    <p className="text-center text-sm text-slate-500">
                        Votre abonnement restera actif jusqu'à la fin de votre période de facturation
                    </p>
                </div>
            </div>
        </div>
    );
}
