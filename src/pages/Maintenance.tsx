import { useState, useEffect } from 'react';
import { Clock, MessageCircle, Linkedin } from 'lucide-react';

export function Maintenance() {
    const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });

    useEffect(() => {
        const target = new Date('2026-02-18T11:00:00+01:00').getTime();

        const updateTimer = () => {
            const now = new Date().getTime();
            const difference = target - now;

            if (difference > 0) {
                const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((difference % (1000 * 60)) / 1000);
                setTimeLeft({ hours, minutes, seconds });
            } else {
                setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
                // Auto-refresh at launch
                if (difference > -5000) { // Only refresh if we just crossed the line
                    window.location.reload();
                }
            }
        };

        const interval = setInterval(updateTimer, 1000);
        updateTimer(); // Initial call

        return () => clearInterval(interval);
    }, []);

    const format = (n: number) => n.toString().padStart(2, '0');

    return (
        <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px]" />
            </div>

            <div className="z-10 text-center max-w-2xl mx-auto space-y-8 animate-in fade-in zoom-in duration-700">

                <div className="inline-flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl mb-6">
                    <img src="/logo.PNG" alt="CloseOS" className="h-12 w-auto" />
                </div>

                <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
                    Lancement Imminent
                </h1>

                <div className="space-y-6">
                    <p className="text-xl text-slate-400">
                        Nous finalisons les derniers détails avant l'ouverture officielle.
                    </p>

                    <div className="flex flex-col items-center gap-4">
                        <div className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-mono text-3xl md:text-4xl font-bold shadow-lg shadow-blue-500/5 tracking-wider">
                            <Clock className="w-6 h-6 md:w-8 md:h-8 animate-pulse text-blue-500" />
                            <span>
                                {format(timeLeft.hours)} : {format(timeLeft.minutes)} : {format(timeLeft.seconds)}
                            </span>
                        </div>
                        <span className="text-sm text-slate-500 font-mono">Rendez-vous Mercredi 18/02 à 11h00</span>
                    </div>
                </div>

                <div className="pt-8 grid gap-4 w-full max-w-md mx-auto">
                    <a
                        href="https://whatsapp.com/channel/0029Vb7P4lqDDmFLVtD7Jn0s"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative flex items-center justify-center gap-3 w-full bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/20 text-[#25D366] px-6 py-4 rounded-xl font-medium transition-all duration-300 hover:scale-[1.02]"
                    >
                        <MessageCircle className="w-5 h-5" />
                        <span>Rejoindre le groupe WhatsApp</span>
                        <span className="bg-[#25D366] text-[#020617] text-xs font-bold px-2 py-0.5 rounded-full ml-2 animate-pulse">
                            -15% OFF
                        </span>
                    </a>

                    <a
                        href="https://www.linkedin.com/in/thomas-shamoev-570885237/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-3 w-full bg-[#0077b5]/10 hover:bg-[#0077b5]/20 border border-[#0077b5]/20 text-[#0077b5] px-6 py-4 rounded-xl font-medium transition-all duration-300 hover:scale-[1.02]"
                    >
                        <Linkedin className="w-5 h-5" />
                        <span>Me suivre sur LinkedIn</span>
                    </a>
                </div>
            </div>
        </div>
    );
}
