import { Outlet, useLocation } from 'react-router-dom'
import { BusinessSidebar } from '../components/BusinessSidebar'
import { Menu } from 'lucide-react'
import { useState } from 'react'

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/business/dashboard': { title: 'Dashboard', subtitle: "Vue d'ensemble de votre business" },
  '/business/crm': { title: 'CRM', subtitle: 'Gérez vos prospects' },
  '/business/team': { title: 'Équipe', subtitle: 'Gérez votre équipe' },
  '/business/kpi': { title: 'KPI & Performance', subtitle: 'Analysez vos performances commerciales' },
  '/business/campagnes': { title: 'Campagnes', subtitle: 'Gérez vos campagnes de capture de leads' },
  '/business/formules': { title: 'Formules', subtitle: 'Gérez vos formules tarifaires et ressources' },
  '/business/rendez-vous': { title: 'Rendez-vous', subtitle: 'Tous vos rendez-vous pris via les campagnes' },
}

export function BusinessLayout() {
  const location = useLocation()
  const pageInfo = PAGE_TITLES[location.pathname] || { title: 'CloseOS Business', subtitle: '' }
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-[#FDF6EE] overflow-hidden">
      <BusinessSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <header className="z-30 border-b border-amber-200 bg-white/80 backdrop-blur-md">
          <div className="flex h-16 items-center justify-between px-4 sm:px-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 text-slate-500 hover:text-slate-900 lg:hidden"
              >
                <Menu className="h-6 w-6" />
              </button>

              <div>
                <h1 className="text-xl font-bold text-slate-900">{pageInfo.title}</h1>
                <p className="text-xs text-slate-500">{pageInfo.subtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-50 px-3 py-1.5 xs:flex">
                <div className="h-2 w-2 animate-pulse rounded-full bg-amber-500"></div>
                <span className="text-xs font-medium text-amber-700">Business</span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[#FDF6EE] p-4 sm:p-8 min-h-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
