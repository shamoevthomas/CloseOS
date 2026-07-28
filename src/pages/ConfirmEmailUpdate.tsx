import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, Lock, Mail, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function ConfirmEmailUpdate() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('idle');
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user?.email) setEmail(user.email);
        });
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) {
            setErrorMessage("Lien invalide ou manquant.");
            setStatus('error');
            return;
        }

        setLoading(true);
        setErrorMessage('');

        try {
            // 1. Re-authentification pour vérifier le mot de passe
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (authError) {
                throw new Error("Email ou mot de passe incorrect.");
            }

            const userIdFromAuth = authData.user.id;

            // 2. Appel API pour valider le changement
            const response = await fetch('/api/confirm-email-change', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId: userIdFromAuth, token })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Erreur lors de la confirmation.");
            }

            setStatus('success');

            await supabase.auth.refreshSession();

            setTimeout(() => {
                navigate('/dashboard');
            }, 3000);

        } catch (error: any) {
            console.error(error);
            setStatus('error');
            setErrorMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="min-h-screen bg-[#f4f2f1] dark:bg-[#0d0d0d] flex items-center justify-center p-4">
                <div className="bg-white dark:bg-[#1a1a1a] border border-red-500/20 rounded-2xl p-8 max-w-md w-full text-center">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Lien invalide</h1>
                    <p className="text-slate-500 dark:text-neutral-400">Le lien de confirmation est manquant ou incomplet.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#f4f2f1] dark:bg-[#0d0d0d] flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-sky-600/5 blur-[100px] rounded-full" />
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-sky-500/5 blur-[100px] rounded-full" />
            </div>

            <div className="w-full max-w-md bg-slate-50 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-3xl p-8 shadow-2xl relative z-10">

                {status === 'success' ? (
                    <div className="text-center py-8 animate-in fade-in zoom-in duration-300">
                        <div className="w-20 h-20 bg-sky-500/15 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle className="h-10 w-10 text-sky-700 dark:text-sky-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Email mis à jour !</h2>
                        <p className="text-slate-500 dark:text-neutral-400 mb-6">Votre adresse email a été modifiée avec succès.</p>
                        <p className="text-sm text-slate-400 dark:text-neutral-500">Redirection vers le tableau de bord...</p>
                    </div>
                ) : (
                    <>
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-sky-500/15 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-sky-500/30">
                                <Mail className="h-8 w-8 text-sky-600 dark:text-sky-400" />
                            </div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Confirmation requise</h1>
                            <p className="text-slate-500 dark:text-neutral-400 mt-2 text-sm">
                                Pour sécuriser le changement d'email, veuillez confirmer votre mot de passe actuel.
                            </p>
                        </div>

                        {status === 'error' && (
                            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3 text-red-600 text-sm items-start">
                                <AlertCircle className="h-5 w-5 shrink-0" />
                                <p>{errorMessage}</p>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wider block">Email actuel</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-neutral-500" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-white/50 border border-slate-200 dark:border-white/10 rounded-xl pl-11 pr-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-all"
                                        placeholder="votrenom@exemple.com"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wider block">Mot de passe</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-neutral-500" />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-white/50 border border-slate-200 dark:border-white/10 rounded-xl pl-11 pr-10 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-all"
                                        placeholder="Votre mot de passe"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-neutral-400 hover:text-slate-900 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !password || !email}
                                className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-sky-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirmer le changement"}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
