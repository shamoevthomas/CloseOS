import { Check, type LucideIcon } from 'lucide-react'
import { cn } from '../lib/utils'

interface ComingSoonProps {
  title: string
  description: string
  icon: LucideIcon
  features: string[]
}

export function ComingSoon({ title, description, icon: Icon, features }: ComingSoonProps) {
  return (
    <div className="flex min-h-[calc(100vh-120px)] items-center justify-center p-8">
      <div className="w-full max-w-2xl text-center">
        {/* Icon with Glow Effect */}
        <div className="relative mx-auto mb-8 inline-flex">
          {/* Glow effect */}
          <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-r from-blue-500 to-purple-500 opacity-20 blur-3xl"></div>

          {/* Icon container */}
          <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 ring-1 ring-blue-500/30">
            <Icon className="h-12 w-12 text-blue-400" />
          </div>
        </div>

        {/* Title with Gradient */}
        <h1 className="mb-4 text-4xl font-bold">
          <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            {title}
          </span>
        </h1>

        {/* Description */}
        <p className="mb-8 text-lg text-slate-400">
          {description}
        </p>

        {/* Features List */}
        <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-8 backdrop-blur-sm">
          <h2 className="mb-6 text-xl font-semibold text-white">
            Fonctionnalités à venir
          </h2>
          <div className="grid gap-4 text-left">
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex items-start gap-3 rounded-lg bg-slate-800/50 p-4 transition-all hover:bg-slate-800"
              >
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                  <Check className="h-4 w-4 text-emerald-400" />
                </div>
                <p className="text-sm font-medium text-slate-300">{feature}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Coming Soon Badge */}
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-6 py-3">
          <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500"></div>
          <span className="text-sm font-semibold text-blue-400">En développement</span>
        </div>

        {/* Disabled Button */}
        <div className="mt-6">
          <button
            disabled
            className={cn(
              'cursor-not-allowed rounded-lg border border-slate-700 bg-slate-800 px-8 py-3 text-sm font-semibold text-slate-500',
              'opacity-50'
            )}
          >
            Bientôt disponible
          </button>
        </div>

        {/* Additional Info */}
        <p className="mt-6 text-xs text-slate-600">
          Cette fonctionnalité sera disponible dans une prochaine mise à jour
        </p>
      </div>
    </div>
  )
}
