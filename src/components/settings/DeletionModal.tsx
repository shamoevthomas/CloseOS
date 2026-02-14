import { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, Calendar, Trash2, ArrowRight, Loader2 } from 'lucide-react';
import { getCalApi } from "@calcom/embed-react";
import Cal from "@calcom/embed-react";
import { supabase } from '../../lib/supabase';

interface DeletionModalProps {
    isOpen: boolean;
    onClose: () => void;
    userEmail: string;
    userId: string;
    onSuccess: () => void;
}

export function DeletionModal({ isOpen, onClose, userEmail, userId, onSuccess }: DeletionModalProps) {
    const [step, setStep] = useState<'select' | 'confirm' | 'cal' | 'final'>('select');
    const [scope, setScope] = useState<string[]>(['all']);
    const [loading, setLoading] = useState(false);
    const [scheduledDate, setScheduledDate] = useState<string | null>(null);

    useEffect(() => {
        if (step === 'cal' && isOpen) {
            (async function () {
                const cal = await getCalApi({ "namespace": "demande-d-annulation-closeos" });
                cal("ui", { "theme": "dark", "hideEventTypeDetails": false, "layout": "month_view" });
            })();
        }
    }, [step, isOpen]);

    if (!isOpen) return null;

    const handleScopeChange = (value: string) => {
        if (value === 'all') {
            if (scope.includes('all')) {
                setScope([]);
            } else {
                setScope(['all']);
            }
        } else {
            let newScope = [...scope];
            if (scope.includes('all')) {
                newScope = []; // Deselect all if unchecked specific
            }

            if (newScope.includes(value)) {
                newScope = newScope.filter(s => s !== value);
            } else {
                newScope.push(value);
            }

            // Check if all specific options are selected
            const allOptions = ['billing', 'internal', 'external'];
            const isAllSelected = allOptions.every(o => newScope.includes(o));
            if (isAllSelected) {
                setScope(['all']);
            } else {
                setScope(newScope);
            }
        }
    };

    const handleValidation = () => {
        if (scope.length === 0) return;
        setStep('confirm');
    };

    const handleConfirmDeletion = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/request-deletion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, scope })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            if (data.scheduledAt) {
                setScheduledDate(data.scheduledAt);
            }

            setStep('cal'); // Proceed to exit interview / info
        } catch (error) {
            console.error(error);
            window.alert("Erreur lors de la demande de suppression.");
        } finally {
            setLoading(false);
        }
    };

    // Skip booking or finish
    const handleFinish = () => {
        onSuccess();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#020617]/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10 bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/30">
                            <Trash2 className="h-5 w-5 text-red-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Suppression du compte</h2>
                            <p className="text-sm text-slate-400">Cette action est importante et irreversible.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                        <X className="h-5 w-5 text-slate-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">

                    {step === 'select' && (
                        <div className="space-y-6">
                            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-3 text-amber-200">
                                <AlertTriangle className="h-5 w-5 shrink-0" />
                                <p className="text-sm">Vous êtes sur le point de supprimer votre compte. Vous pouvez choisir de supprimer certaines données spécifiques ou l'ensemble de votre compte.</p>
                            </div>

                            <div className="space-y-3">
                                <label className="flex items-center gap-3 p-4 bg-white/5 rounded-xl border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={scope.includes('all')}
                                        onChange={() => handleScopeChange('all')}
                                        className="w-5 h-5 rounded border-white/20 bg-white/10 text-red-500 focus:ring-red-500"
                                    />
                                    <div>
                                        <span className="text-white font-medium block">Tout Supprimer</span>
                                        <span className="text-slate-400 text-sm">Compte, facturation, contacts, historiques...</span>
                                    </div>
                                </label>

                                <div className="pl-8 space-y-2">
                                    <label className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={scope.includes('all') || scope.includes('billing')}
                                            onChange={() => handleScopeChange('billing')}
                                            disabled={scope.includes('all')}
                                            className="w-4 h-4 rounded border-white/20 bg-white/10 text-red-500 focus:ring-red-500"
                                        />
                                        <span className="text-slate-300">Données de facturation</span>
                                    </label>
                                    <label className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={scope.includes('all') || scope.includes('internal')}
                                            onChange={() => handleScopeChange('internal')}
                                            disabled={scope.includes('all')}
                                            className="w-4 h-4 rounded border-white/20 bg-white/10 text-red-500 focus:ring-red-500"
                                        />
                                        <span className="text-slate-300">Données de contacts internes</span>
                                    </label>
                                    <label className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={scope.includes('all') || scope.includes('external')}
                                            onChange={() => handleScopeChange('external')}
                                            disabled={scope.includes('all')}
                                            className="w-4 h-4 rounded border-white/20 bg-white/10 text-red-500 focus:ring-red-500"
                                        />
                                        <span className="text-slate-300">Données de contacts externes</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'confirm' && (
                        <div className="space-y-6 text-center py-8">
                            <AlertTriangle className="h-20 w-20 text-red-500 mx-auto opacity-80" />
                            <div>
                                <h3 className="text-2xl font-bold text-white mb-2">Êtes-vous vraiment sûr ?</h3>
                                <p className="text-slate-400 max-w-md mx-auto">
                                    Cette action enclenchera le processus de suppression définitif.
                                    {scheduledDate ? " La suppression sera effective à la fin de votre période de facturation." : ""}
                                </p>
                            </div>
                        </div>
                    )}

                    {step === 'cal' && (
                        <div className="h-[400px] w-full bg-slate-800 rounded-xl overflow-hidden border border-white/10">
                            <div className="p-4 text-center border-b border-white/10 bg-slate-900">
                                <h3 className="text-lg font-bold text-white">Avant de partir...</h3>
                                <p className="text-slate-400 text-sm">Discutons une dernière fois ? (Facultatif)</p>
                            </div>
                            <div className="h-full overflow-y-auto">
                                <Cal
                                    namespace="demande-d-annulation-closeos"
                                    calLink="thomas-sh-ipdmni/demande-d-annulation-closeos"
                                    style={{ width: "100%", height: "100%", overflow: "scroll" }}
                                    config={{ "layout": "month_view", "useSlotsViewOnSmallScreen": "true", "theme": "dark" }}
                                />
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 bg-slate-900/50 flex justify-end gap-3">
                    {step === 'select' && (
                        <button
                            onClick={handleValidation}
                            disabled={scope.length === 0}
                            className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            Continuer <ArrowRight className="h-4 w-4" />
                        </button>
                    )}

                    {step === 'confirm' && (
                        <>
                            <button onClick={onClose} className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors">Annuler</button>
                            <button
                                onClick={handleConfirmDeletion}
                                disabled={loading}
                                className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmer la suppression"}
                            </button>
                        </>
                    )}

                    {step === 'cal' && (
                        <button
                            onClick={handleFinish}
                            className="w-full px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            J'ai pris rendez-vous / Je ne souhaite pas discuter <ArrowRight className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
