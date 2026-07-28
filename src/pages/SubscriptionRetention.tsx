import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getCalApi } from "@calcom/embed-react";
import Cal from "@calcom/embed-react";
import { Loader2, ArrowLeft, CalendarCheck } from 'lucide-react';

export function SubscriptionRetention() {
    const lang = (localStorage.getItem('closeos_lang') || 'fr') as 'fr' | 'en';
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const uid = searchParams.get('uid');
    const [loading, setLoading] = useState(false);
    const [reactivated, setReactivated] = useState(false);
    const [calOpen, setCalOpen] = useState(false);

    useEffect(() => {
        (async function () {
            const cal = await getCalApi({ "namespace": "demande-d-annulation-closeos" });
            cal("ui", { "theme": "dark", "hideEventTypeDetails": false, "layout": "month_view" });
        })();
    }, []);

    const handleReactivateAndBook = async () => {
        if (!uid) return;

        setLoading(true);
        try {
            // 1. Reactivate Subscription
            const response = await fetch('/api/reactivate-subscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: uid })
            });

            if (response.ok) {
                setReactivated(true);
                // 2. Open Calendar (We'll just show the Cal component now)
                setCalOpen(true);
            } else {
                console.error("Failed to reactivate");
                alert(lang === 'fr' ? "Une erreur est survenue lors de la réactivation. Veuillez contacter le support." : "An error occurred during reactivation. Please contact support.");
            }
        } catch (error) {
            console.error("Error:", error);
            alert(lang === 'fr' ? "Erreur de connexion." : "Connection error.");
        } finally {
            setLoading(false);
        }
    };

    const handleLeave = () => {
        navigate('/'); // Redirect to landing page
    };

    if (!uid) {
        return (
            <div className="min-h-screen bg-[#f4f2f1] dark:bg-[#0d0d0d] flex items-center justify-center text-slate-900 dark:text-white">
                <p>{lang === 'fr' ? 'Lien invalide.' : 'Invalid link.'}</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f4f2f1] dark:bg-[#0d0d0d] flex flex-col items-center justify-center p-4">
            <div className="max-w-2xl w-full bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden p-8 text-center space-y-8">

                {!calOpen ? (
                    <>
                        <div>
                            <div className="w-16 h-16 bg-sky-500/15 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CalendarCheck className="h-8 w-8 text-sky-600 dark:text-sky-400" />
                            </div>
                            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">{lang === 'fr' ? 'Avant de nous quitter...' : 'Before you leave...'}</h1>
                            <p className="text-slate-500 dark:text-neutral-400 text-lg">
                                {lang === 'fr' ? "Votre départ nous attriste. Nous aimerions comprendre ce qui n'a pas fonctionné pour vous." : "We're sad to see you go. We'd like to understand what didn't work for you."}
                            </p>
                            <p className="text-slate-500 dark:text-neutral-400 mt-2">
                                {lang === 'fr' ? "Acceptez-vous d'en discuter 5 minutes de vive voix ?" : 'Would you agree to a 5-minute call to discuss?'}
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                            <button
                                onClick={handleReactivateAndBook}
                                disabled={loading}
                                className="px-8 py-4 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-sky-500/25 flex items-center justify-center gap-3"
                            >
                                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                                {lang === 'fr' ? 'Je prends rendez-vous avant de partir' : 'Book an appointment before leaving'}
                            </button>
                        </div>

                        <button
                            onClick={handleLeave}
                            className="text-slate-400 dark:text-neutral-500 hover:text-slate-900 transition-colors text-sm underline underline-offset-4"
                        >
                            {lang === 'fr' ? 'Non merci, je préfère partir' : "No thanks, I'd rather leave"}
                        </button>
                    </>
                ) : (
                    <div className="space-y-6 animate-in fade-in zoom-in duration-300">
                        <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-4 text-sky-600 dark:text-sky-400 font-medium">
                            {lang === 'fr' ? 'Votre abonnement a été maintenu. Merci de nous donner une seconde chance !' : 'Your subscription has been maintained. Thank you for giving us a second chance!'} ❤️
                        </div>
                        <div className="h-[600px] w-full bg-white dark:bg-[#1a1a1a] rounded-xl overflow-hidden border border-slate-200 dark:border-white/10">
                            <Cal
                                namespace="demande-d-annulation-closeos"
                                calLink="thomas-sh-ipdmni/demande-d-annulation-closeos"
                                style={{ width: "100%", height: "100%", overflow: "scroll" }}
                                config={{ "layout": "month_view", "useSlotsViewOnSmallScreen": "true", "theme": "dark" }}
                            />
                        </div>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="px-6 py-2 bg-white/5 hover:bg-white/10 text-slate-900 dark:text-white rounded-lg transition-colors"
                        >
                            {lang === 'fr' ? 'Retour au Dashboard' : 'Back to Dashboard'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
