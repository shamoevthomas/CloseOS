import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
// Import de NotificationBell supprimé
import { Eye, EyeOff, Menu, Coffee } from 'lucide-react' 
import { usePrivacy } from '../contexts/PrivacyContext'
import { cn } from '../lib/utils'
import { useState } from 'react'

interface LayoutProps {
  onOpenSettings: () => void
}

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Cockpit', subtitle: "Vue d'ensemble de vos performances" },
  '/pipeline': { title: 'Pipeline', subtitle: 'Suivez vos deals' },
  '/contacts': { title: 'Contacts', subtitle: 'Gérez vos prospects' },
  '/offers': { title: 'Mes Offres', subtitle: 'Gérez vos services' },
  '/agenda': { title: 'Agenda', subtitle: 'Votre emploi du temps' },
  '/kpi': { title: 'KPI', subtitle: 'Analysez vos perfs' },
  '/calls': { title: 'Appels', subtitle: 'Gestion vidéo' },
  '/messages': { title: 'Messages', subtitle: 'Communication' },
  '/telephony': { title: 'Téléphonie', subtitle: 'Centralisez vos échanges' },
  '/ai-coach': { title: 'Coach IA', subtitle: 'Optimisez vos ventes' },
  '/invoices': { title: 'Factures', subtitle: 'Suivez vos paiements' },
  '/rendez-vous': { title: 'Rendez-vous', subtitle: 'Gérez vos créneaux' }
}

export function Layout({ onOpenSettings }: LayoutProps) {
  const location = useLocation()
  const { isPrivacyEnabled, togglePrivacy } = usePrivacy()
  const pageInfo = PAGE_TITLES[location.pathname] || { title: 'CloserOS', subtitle: '' }
  
  // État pour gérer l'ouverture du menu sur mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Sidebar avec gestion du mobile */}
      <Sidebar 
        onOpenSettings={onOpenSettings} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Header adapté Mobile & Desktop */}
        <header className="z-30 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md">
          <div className="flex h-16 items-center justify-between px-4 sm:px-8">
            
            {/* Bouton Menu Mobile + Titre */}
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 text-slate-400 hover:text-white lg:hidden"
              >
                <Menu className="h-6 w-6" />
              </button>
              
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold text-white">{pageInfo.title}</h1>
                <p className="text-xs text-slate-500">{pageInfo.subtitle}</p>
              </div>

              {/* Logo minimal sur mobile très petit */}
              <div className="flex items-center gap-2 sm:hidden">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                  <Coffee className="h-4 w-4 text-white" />
                </div>
                <h1 className="text-lg font-bold text-white">{pageInfo.title}</h1>
              </div>
            </div>

            {/* Actions Droite */}
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={togglePrivacy}
                className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-slate-800 sm:px-4 sm:py-2"
              >
                {isPrivacyEnabled ? (
                  <>
                    <Eye className="h-4 w-4 text-emerald-400" />
                    <span className="hidden text-sm font-medium text-emerald-400 md:block">Discrétion</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="h-4 w-4 text-slate-400" />
                    <span className="hidden text-sm font-medium text-slate-400 md:block">Discrétion</span>
                  </>
                )}
              </button>

              {/* NotificationBell supprimé d'ici */}

              {/* Live Indicator - Caché sur mobile très petit */}
              <div className="hidden items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 xs:flex">
                <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500"></div>
                <span className="text-xs font-medium text-blue-400">Live</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-slate-950 p-4 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}