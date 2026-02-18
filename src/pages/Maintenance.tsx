import { Clock } from 'lucide-react';

export function Maintenance() {

    return (
        <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px]" />
            </div>

            <div className="z-10 text-center max-w-2xl mx-auto space-y-8 animate-in fade-in zoom-in duration-700">

                <div className="inline-flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl mb-6">
                    <img src="/logo_closeos.png" alt="CloseOS" className="h-12 w-auto" />
                </div>

                <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
                    Lancement Imminent
                </h1>

                <div className="space-y-4">
                    <p className="text-xl text-slate-400">
                        Nous finalisons les derniers détails avant l'ouverture officielle.
                    </p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-mono">
                        <Clock className="w-4 h-4" />
                        <span>Rendez-vous Mercredi 18/02 à 11h00</span>
                    </div>
                </div>

                <div className="pt-8">
                    <div className="relative">
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-emerald-600 rounded-xl blur opacity-25"></div>
                        <div className="relative bg-slate-900 border border-slate-800 rounded-xl p-6">
                            <p className="text-slate-300 mb-4">Rejoignez la liste d'attente prioritaire</p>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <input
                                    type="email"
                                    placeholder="votre@email.com"
                                    disabled
                                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-slate-500 cursor-not-allowed"
                                    value="Inscription bientôt ouverte"
                                />
                                <button disabled className="bg-slate-800 text-slate-500 px-6 py-3 rounded-lg font-medium cursor-not-allowed">
                                    S m'inscrire
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
