
import { type LucideIcon, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface ComingSoonProps {
    icon: LucideIcon
    title: string
    description: string
    features?: string[]
}

export function ComingSoon({ icon: Icon, title, description, features }: ComingSoonProps) {
    const navigate = useNavigate()

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 flex items-center justify-center">
            <div className="max-w-2xl w-full text-center space-y-8">

                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20 mb-6 animate-pulse">
                    <Icon className="h-12 w-12 text-blue-600 dark:text-blue-400" />
                </div>

                <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    {title} <span className="text-blue-600 dark:text-blue-400">bientôt disponible</span>
                </h1>

                <p className="text-lg text-slate-500 dark:text-slate-400 leading-relaxed max-w-xl mx-auto">
                    {description}
                </p>

                {features && features.length > 0 && (
                    <div className="mt-8 grid gap-3 text-left max-w-lg mx-auto bg-white dark:bg-slate-900/50 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
                        {features.map((feature, index) => (
                            <div key={index} className="flex items-start gap-3 text-slate-600 dark:text-slate-300">
                                <div className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                                <span>{feature}</span>
                            </div>
                        ))}
                    </div>
                )}

                <div className="pt-8">
                    <button
                        onClick={() => navigate('/')}
                        className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Retour au tableau de bord
                    </button>
                </div>

            </div>
        </div>
    )
}
