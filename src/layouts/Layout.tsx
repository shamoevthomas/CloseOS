import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { NotificationBell } from '../components/NotificationBell'
import { Eye, EyeOff } from 'lucide-react'
import { usePrivacy } from '../contexts/PrivacyContext'
import { cn } from '../lib/utils'

interface LayoutProps {
  onOpenSettings: () => void
}

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': {
    title: 'Cockpit',
    subtitle: "Vue d'ensemble de vos performances commerciales"
  },
  '/pipeline': {
    title: 'Pipeline Commercial',
    subtitle: 'Suivez et gérez vos deals par étapes'
  },
  '/contacts': {
    title: 'Contacts',
    subtitle: 'Gérez vos prospects et contacts internes'
  },
  '/offers': {
    title: 'Mes Offres',
    subtitle: 'Gérez vos produits et services commerciaux'
  },
  '/agenda': {
    title: 'Agenda',
    subtitle: 'Votre emploi du temps du jour'
  },
  '/kpi': {
    title: 'KPI & Analytics',
    subtitle: 'Analysez vos performances par offre'
  },
  '/calls': {
    title: 'Appels',
    subtitle: 'Historique et gestion de vos appels vidéo'
  },
  '/messages': {
    title: 'Messages',
    subtitle: 'Communication interne avec votre équipe'
  },
  '/telephony': {
    title: 'Téléphonie & SMS',
    subtitle: 'Centralisez toutes vos communications'
  },
  '/ai-coach': {
    title: 'Coach IA',
    subtitle: 'Devenez un Top Closer avec l\'IA'
  },
  '/invoices': {
    title: 'Facturation & Paiements',
    subtitle: 'Gérez votre administratif en un clic'
  }
}

export function Layout({ onOpenSettings }: LayoutProps) {
  const location = useLocation()
  const { isPrivacyEnabled, togglePrivacy } = usePrivacy()

  const pageInfo = PAGE_TITLES[location.pathname] || {
    title: 'CloserOS',
    subtitle: 'SaaS de gestion commerciale'
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      {/* Sidebar */}
      <Sidebar onOpenSettings={onOpenSettings} />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* TopBar - Fixed Header */}
        <header className="sticky top-0 z-10 border-b border-slate-800/50 bg-slate-950 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">{pageInfo.title}</h1>
              <p className="mt-1 text-sm text-slate-400">{pageInfo.subtitle}</p>
            </div>

            <div className="flex items-center gap-4">
              {/* Notification Bell */}
              <NotificationBell />

              {/* Privacy Mode Toggle */}
              <button
                onClick={togglePrivacy}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-4 py-2 transition-all',
                  isPrivacyEnabled
                    ? 'border-emerald-500/50 bg-emerald-500/10'
                    : 'border-slate-700 bg-slate-800/50 hover:bg-slate-800'
                )}
              >
                {isPrivacyEnabled ? (
                  <>
                    <Eye className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-400">Mode Discrétion</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="h-4 w-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-400">Mode Discrétion</span>
                  </>
                )}
                <div
                  className={cn(
                    'relative h-5 w-9 rounded-full transition-colors',
                    isPrivacyEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                  )}
                >
                  <div
                    className={cn(
                      'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
                      isPrivacyEnabled ? 'translate-x-4' : 'translate-x-0.5'
                    )}
                  />
                </div>
              </button>

              {/* Live Indicator */}
              <div className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2">
                <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500"></div>
                <span className="text-sm font-medium text-blue-400">En direct</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-slate-950">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
