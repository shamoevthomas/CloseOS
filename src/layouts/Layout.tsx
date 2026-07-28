import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { ReminderBell } from '../components/ReminderBell'
import { Menu } from 'lucide-react'
import { cn } from '../lib/utils'
import { useState } from 'react'
import { ThemeProvider, useTheme } from '../contexts/ThemeContext'

interface LayoutProps {
  onOpenSettings: () => void
}

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Dashboard', subtitle: "Vue d'ensemble de vos performances" },
  '/dashboard': { title: 'Dashboard', subtitle: "Vue d'ensemble de vos performances" },
  '/pipeline': { title: 'Pipeline', subtitle: 'Suivez vos deals' },
  '/contacts': { title: 'Contacts', subtitle: 'Gérez vos prospects' },
  '/offers': { title: 'Mes Offres', subtitle: 'Gérez vos services' },
  '/agenda': { title: 'Agenda', subtitle: 'Votre emploi du temps' },
  '/kpi': { title: 'KPI', subtitle: 'Analysez vos perfs' },
  '/appels': { title: 'Appels', subtitle: 'Gestion vidéo' },
  '/messages': { title: 'Messages', subtitle: 'Communication' },
  '/telephony': { title: 'Téléphonie', subtitle: 'Centralisez vos échanges' },
  '/ai-coach': { title: 'Coach IA', subtitle: 'Optimisez vos ventes' },
  '/factures': { title: 'Factures', subtitle: 'Suivez vos paiements' },
  '/rendez-vous': { title: 'Rendez-vous', subtitle: 'Gérez vos créneaux' },
  '/reminders': { title: 'Rappels', subtitle: 'Gérez vos rappels' },
}

export function Layout({ onOpenSettings }: LayoutProps) {
  return (
    <ThemeProvider>
      <LayoutInner onOpenSettings={onOpenSettings} />
    </ThemeProvider>
  )
}

function LayoutInner({ onOpenSettings }: LayoutProps) {
  const { dark } = useTheme()
  const location = useLocation()
  const basePath = location.pathname.replace(/\/[^/]+$/, '')
  const pageInfo = PAGE_TITLES[location.pathname] || PAGE_TITLES[basePath] || { title: 'CloseOS', subtitle: '' }

  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)

  const manrope = { fontFamily: 'Manrope, sans-serif' } as const

  return (
    <div className={cn(
      "flex h-screen bg-[#f4f2f1] dark:bg-[#0d0d0d] overflow-hidden transition-colors duration-300",
      dark && 'dark'
    )}>
      {/* Sidebar — Business-style collapsible floating rail */}
      <Sidebar
        onOpenSettings={onOpenSettings}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onCollapseChange={setIsSidebarCollapsed}
      />

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden lg:ml-24">
        {/* Minimal mobile header — desktop uses an in-content header */}
        <header className="z-30 lg:hidden border-b border-slate-200 dark:border-white/10 bg-white/70 dark:bg-[#1a1a1a]/70 backdrop-blur-xl">
          <div className="flex h-14 items-center justify-between px-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-tight" style={manrope}>
              {pageInfo.title}
            </h1>
            <ReminderBell />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-[#f4f2f1] dark:bg-[#0d0d0d] px-5 sm:px-8 lg:px-12 py-6 sm:py-8 lg:py-10 min-h-0 relative transition-colors duration-300">
          {/* Decorative gradient blob */}
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-br from-sky-100/40 dark:from-sky-900/15 to-transparent rounded-full -mr-64 -mt-64 blur-3xl pointer-events-none" />

          {/* Desktop actions cluster (bell + live) — pages render their own titles, Business-style.
              z-20 stays below drawers (z-50) and modals (z-60) so it never steals their clicks. */}
          <div className="fixed top-6 right-8 z-20 hidden lg:flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1.5 xl:flex">
              <div className="h-2 w-2 animate-pulse rounded-full bg-sky-500" />
              <span className="text-xs font-medium text-sky-700 dark:text-sky-400">Live</span>
            </div>
            <ReminderBell />
          </div>

          {/* No z-index here: a stacking context would trap page drawers/modals below the fixed bell. */}
          <div className="relative max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
