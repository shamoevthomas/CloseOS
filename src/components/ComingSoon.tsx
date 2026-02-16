import type { LucideIcon } from 'lucide-react'

interface ComingSoonProps {
    icon: LucideIcon
    title: string
    description: string
    features?: string[]
}

export function ComingSoon({ icon: Icon, title, description, features }: ComingSoonProps) {
    return (
        <div className="min-h-screen bg-slate-950 p-8 flex items-center justify-center text-slate-200">
            <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center shadow-2xl relative overflow-hidden">

                {/* EFFET DE FOND */}
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[80px] pointer-events-none"></div>

                <div className="relative z-10">
                    <div className="inline-flex items-center justify-center p-5 bg-slate-800/50 rounded-full mb-8 ring-1 ring-white/10">
                        <Icon className="w-10 h-10 text-blue-500" />
                    </div>

                    <h1 className="text-3xl font-bold text-white mb-4">
                        {title}
                    </h1>

                    <p className="text-lg text-slate-400 mb-8 leading-relaxed">
                        {description}
                    </p>

                    {features && (
                        <div className="bg-slate-950/50 rounded-xl p-6 border border-slate-800/50 text-left inline-block w-full max-w-sm">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Ce qui arrive :</h3>
                            <ul className="space-y-3">
                                {features.map((feature, i) => (
                                    <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="mt-8 pt-8 border-t border-slate-800/50">
                        <div className="inline-block px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold border border-blue-500/20">
                            🚧 Développement en cours
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
