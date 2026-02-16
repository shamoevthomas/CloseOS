
import { type LucideIcon } from 'lucide-react'

interface ComingSoonProps {
    icon: LucideIcon
    title: string
    description: string
    features: string[]
}

export function ComingSoon({ icon: Icon, title, description, features }: ComingSoonProps) {
    return (
        <div className="flex h-full flex-col items-center justify-center p-8 text-center animate-in fade-in duration-700">
            <div className="mb-6 relative">
                <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
                <div className="relative bg-slate-800/50 p-6 rounded-2xl border border-white/10">
                    <Icon className="h-12 w-12 text-blue-400" />
                </div>
            </div>

            <h2 className="text-3xl font-bold text-white mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                {title}
            </h2>

            <p className="text-slate-400 max-w-md mb-8 text-lg leading-relaxed">
                {description}
            </p>

            <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 max-w-sm w-full backdrop-blur-sm">
                <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">Fonctionnalités à venir</h3>
                <ul className="space-y-3 text-left">
                    {features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-3 text-slate-400 text-sm">
                            <div className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                            {feature}
                        </li>
                    ))}
                </ul>
            </div>

            <div className="mt-8 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-sm font-medium">
                Disponible prochainement
            </div>
        </div>
    )
}
