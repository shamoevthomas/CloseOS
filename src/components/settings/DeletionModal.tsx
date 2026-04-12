import { useState, useEffect } from 'react';
import { X, AlertTriangle, Trash2, ArrowRight, Loader2, Lock, ShieldAlert } from 'lucide-react';
import { getCalApi } from "@calcom/embed-react";
import Cal from "@calcom/embed-react";
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../contexts/LanguageContext';

interface DeletionModalProps {
    isOpen: boolean;
    onClose: () => void;
    userEmail: string;
    userId: string;
    onSuccess: () => void;
}

export function DeletionModal({ isOpen, onClose, userEmail, userId, onSuccess }: DeletionModalProps) {
    const { lang } = useLanguage();
    const [step, setStep] = useState<'initial' | 'select' | 'confirm' | 'cal' | 'final'>('initial');
    const [scope, setScope] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setStep('initial');
            setScope([]);
            setPassword('');
            setError('');
        }
    }, [isOpen]);

    useEffect(() => {
        if (step === 'cal' && isOpen) {
            (async function () {
                const cal = await getCalApi({ "namespace": "demande-d-annulation-closeos" });
                cal("ui", { "theme": "dark", "hideEventTypeDetails": false, "layout": "month_view" });
            })();
        }
    }, [step, isOpen]);

    if (!isOpen) return null;

    const handleInitialChoice = (wantsToDeleteData: boolean) => {
        if (wantsToDeleteData) {
            setStep('select');
        } else {
            // "Non, conserver les données" -> Scope destruction is empty. Only Auth User is deleted.
            setScope([]);
            setStep('cal');
        }
    };

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
            const allOptions = ['billing', 'internal', 'external', 'personal'];
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
        setStep('cal');
    };

    const handleRefuseMeeting = () => {
        setStep('confirm');
    };

    const handleAppointmentBooked = () => {
        // Just close, do not delete.
        onClose();
    };

    const handleConfirmDeletion = async () => {
        if (!password) {
            setError(lang === 'fr' ? 'Le mot de passe est requis.' : 'Password is required.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // 1. Verify Password
            const { error: authError } = await supabase.auth.signInWithPassword({
                email: userEmail,
                password: password
            });

            if (authError) {
                throw new Error(lang === 'fr' ? 'Mot de passe incorrect.' : 'Incorrect password.');
            }

            // 2. Request Deletion
            const response = await fetch('/api/request-deletion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, scope })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            if (data.deferred) {
                // Subscription active — deletion scheduled for later
                alert(lang === 'fr'
                    ? `Votre compte sera supprimé le ${new Date(data.scheduledAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}. Vous gardez l'accès jusque là.`
                    : `Your account will be deleted on ${new Date(data.scheduledAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}. You keep access until then.`);
                onSuccess();
                onClose();
            } else {
                // No subscription — account deleted immediately
                await supabase.auth.signOut();
                window.location.href = '/';
            }
        } catch (error: any) {
            console.error(error);
            setError(error.message || (lang === 'fr' ? "Erreur lors de la suppression." : "Error during deletion."));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
            <div className="relative w-full max-w-2xl bg-[#1a1a1a] border border-white/[0.08] rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/[0.08] bg-[#111111]/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/30">
                            <Trash2 className="h-5 w-5 text-red-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">{lang === 'fr' ? 'Suppression du compte' : 'Account deletion'}</h2>
                            <p className="text-sm text-white/40">{lang === 'fr' ? 'Cette action est importante et irreversible.' : 'This action is important and irreversible.'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="h-5 w-5 text-white/40" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">

                    {step === 'initial' && (
                        <div className="space-y-8 text-center py-8">
                            <div className="p-4 bg-emerald-500/10 rounded-full w-fit mx-auto">
                                <ShieldAlert className="h-12 w-12 text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-white mb-4">{lang === 'fr' ? 'Souhaitez-vous supprimer vos données ?' : 'Do you want to delete your data?'}</h3>
                                <p className="text-white/40 max-w-md mx-auto">
                                    {lang === 'fr' ? 'En plus de votre compte, souhaitez-vous supprimer définitivement les données qui y sont associées (factures, contacts, historiques...) ?' : 'In addition to your account, do you want to permanently delete associated data (invoices, contacts, history...)?'}
                                </p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                                <button
                                    onClick={() => handleInitialChoice(true)}
                                    className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-full font-bold transition-all border border-red-500/20"
                                >
                                    {lang === 'fr' ? 'Oui, supprimer des données' : 'Yes, delete data'}
                                </button>
                                <button
                                    onClick={() => handleInitialChoice(false)}
                                    className="px-6 py-3 bg-white/[0.03] hover:bg-white/10 text-white rounded-full font-bold transition-all border border-white/[0.08]"
                                >
                                    {lang === 'fr' ? 'Non, conserver les données' : 'No, keep data'}
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'select' && (
                        <div className="space-y-6">
                            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex gap-3 text-amber-200">
                                <AlertTriangle className="h-5 w-5 shrink-0" />
                                <p className="text-sm">{lang === 'fr' ? 'Sélectionnez les données que vous souhaitez supprimer définitivement.' : 'Select the data you want to permanently delete.'}</p>
                            </div>

                            <div className="space-y-3">
                                <label className="flex items-center gap-3 p-4 bg-white/[0.03] rounded-2xl border border-white/[0.08] cursor-pointer hover:bg-white/10 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={scope.includes('all')}
                                        onChange={() => handleScopeChange('all')}
                                        className="w-5 h-5 rounded border-white/20 bg-white/10 text-red-500 focus:ring-red-500"
                                    />
                                    <div>
                                        <span className="text-white font-medium block">{lang === 'fr' ? 'Tout Supprimer' : 'Delete All'}</span>
                                        <span className="text-white/40 text-sm">{lang === 'fr' ? 'Compte, facturation, contacts, historiques...' : 'Account, billing, contacts, history...'}</span>
                                    </div>
                                </label>

                                <div className="pl-8 space-y-2">
                                    <label className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/[0.08] cursor-pointer hover:bg-white/10 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={scope.includes('all') || scope.includes('personal')}
                                            onChange={() => handleScopeChange('personal')}
                                            disabled={scope.includes('all')}
                                            className="w-4 h-4 rounded border-white/20 bg-white/10 text-red-500 focus:ring-red-500"
                                        />
                                        <span className="text-white/60">{lang === 'fr' ? 'Données personnelles (Nom, email...)' : 'Personal data (Name, email...)'}</span>
                                    </label>
                                    <label className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/[0.08] cursor-pointer hover:bg-white/10 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={scope.includes('all') || scope.includes('billing')}
                                            onChange={() => handleScopeChange('billing')}
                                            disabled={scope.includes('all')}
                                            className="w-4 h-4 rounded border-white/20 bg-white/10 text-red-500 focus:ring-red-500"
                                        />
                                        <span className="text-white/60">{lang === 'fr' ? 'Données de facturation' : 'Billing data'}</span>
                                    </label>
                                    <label className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/[0.08] cursor-pointer hover:bg-white/10 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={scope.includes('all') || scope.includes('internal')}
                                            onChange={() => handleScopeChange('internal')}
                                            disabled={scope.includes('all')}
                                            className="w-4 h-4 rounded border-white/20 bg-white/10 text-red-500 focus:ring-red-500"
                                        />
                                        <span className="text-white/60">{lang === 'fr' ? 'Données de contacts internes' : 'Internal contacts data'}</span>
                                    </label>
                                    <label className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/[0.08] cursor-pointer hover:bg-white/10 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={scope.includes('all') || scope.includes('external')}
                                            onChange={() => handleScopeChange('external')}
                                            disabled={scope.includes('all')}
                                            className="w-4 h-4 rounded border-white/20 bg-white/10 text-red-500 focus:ring-red-500"
                                        />
                                        <span className="text-white/60">{lang === 'fr' ? 'Données de contacts externes' : 'External contacts data'}</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'confirm' && (
                        <div className="space-y-6 text-center py-8">
                            <AlertTriangle className="h-20 w-20 text-red-500 mx-auto opacity-80" />
                            <div>
                                <h3 className="text-2xl font-bold text-white mb-2">{lang === 'fr' ? 'Êtes-vous vraiment sûr ?' : 'Are you really sure?'}</h3>
                                <p className="text-white/40 max-w-md mx-auto mb-6">
                                    {lang === 'fr' ? 'Cette action est la dernière étape avant la suppression définitive.' : 'This is the final step before permanent deletion.'}
                                </p>

                                <div className="max-w-sm mx-auto space-y-4">
                                    <div className="relative text-left">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all placeholder:text-white/30"
                                            placeholder={lang === 'fr' ? 'Entrez votre mot de passe pour confirmer' : 'Enter your password to confirm'}
                                        />
                                    </div>
                                    {error && (
                                        <p className="text-red-400 text-sm font-medium">{error}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'cal' && (
                        <div className="h-[400px] w-full bg-white/[0.03] rounded-2xl overflow-hidden border border-white/[0.08]">
                            <div className="p-4 text-center border-b border-white/[0.08] bg-[#111111]">
                                <h3 className="text-lg font-bold text-white">{lang === 'fr' ? 'Avant de partir...' : 'Before you go...'}</h3>
                                <p className="text-white/40 text-sm">{lang === 'fr' ? 'Discutons une dernière fois ? (Facultatif)' : 'Let\'s talk one last time? (Optional)'}</p>
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
                <div className="p-6 border-t border-white/[0.08] bg-[#111111]/50 flex justify-end gap-3">
                    {step === 'select' && (
                        <>
                            <button
                                onClick={onClose}
                                className="px-6 py-2 bg-white/[0.03] hover:bg-white/10 text-white/80 rounded-full transition-colors border border-white/[0.08]"
                            >
                                {lang === 'fr' ? 'Finalement ne rien supprimer' : 'Actually, don\'t delete anything'}
                            </button>
                            <button
                                onClick={handleValidation}
                                disabled={scope.length === 0}
                                className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {lang === 'fr' ? 'Continuer' : 'Continue'} <ArrowRight className="h-4 w-4" />
                            </button>
                        </>
                    )}

                    {step === 'cal' && (
                        <div className="w-full flex gap-3">
                            <button
                                onClick={handleAppointmentBooked}
                                className="flex-1 px-4 py-3 bg-emerald-500 hover:bg-emerald-400 text-black rounded-full font-semibold transition-colors flex items-center justify-center gap-2"
                            >
                                {lang === 'fr' ? "J'ai pris rendez-vous" : 'I booked an appointment'}
                            </button>
                            <button
                                onClick={handleRefuseMeeting}
                                disabled={loading}
                                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-full font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                {lang === 'fr' ? 'Je ne souhaite pas discuter' : "I don't want to discuss"}
                            </button>
                        </div>
                    )}

                    {step === 'confirm' && (
                        <>
                            <button onClick={onClose} className="px-6 py-2 bg-white/[0.03] hover:bg-white/10 text-white/80 rounded-full transition-colors border border-white/[0.08]">{lang === 'fr' ? 'Annuler' : 'Cancel'}</button>
                            <button
                                onClick={handleConfirmDeletion}
                                disabled={loading || !password}
                                className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-full font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (lang === 'fr' ? "Valider la suppression" : "Confirm deletion")}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
