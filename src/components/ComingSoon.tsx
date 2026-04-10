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
          <div className="absolute inset-0 animate-pulse rounded-full bg-emerald-500 opacity-20 blur-3xl"></div>

          {/* Icon container */}
          <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/30">
            <Icon className="h-12 w-12 text-emerald-400" />
          </div>
        </div>

        {/* Title with Gradient */}
        <h1 className="mb-4 text-4xl font-bold">
          <span className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-teal-400 bg-clip-text text-transparent">
            {title}
          </span>
        </h1>

        {/* Description */}
        <p className="mb-8 text-lg text-white/40">
          {description}
        </p>

        {/* Features List */}
        <div className="mb-8 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 backdrop-blur-2xl">
          <h2 className="mb-6 text-xl font-semibold text-white">
            Fonctionnalités à venir
          </h2>
          <div className="grid gap-4 text-left">
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex items-start gap-3 rounded-lg bg-white/[0.03] p-4 transition-all hover:bg-white/5"
              >
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                  <Check className="h-4 w-4 text-emerald-400" />
                </div>
                <p className="text-sm font-medium text-white/60">{feature}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Coming Soon Badge */}
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-6 py-3">
          <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></div>
          <span className="text-sm font-semibold text-emerald-400">En développement</span>
        </div>

        {/* Disabled Button */}
        <div className="mt-6">
          <button
            disabled
            className={cn(
              'cursor-not-allowed rounded-full border border-white/[0.08] bg-white/[0.03] px-8 py-3 text-sm font-semibold text-white/40',
              'opacity-50'
            )}
          >
            Bientôt disponible
          </button>
        </div>

        {/* Additional Info */}
        <p className="mt-6 text-xs text-white/40">
          Cette fonctionnalité sera disponible dans une prochaine mise à jour
        </p>
      </div>
    </div>
  )
}
