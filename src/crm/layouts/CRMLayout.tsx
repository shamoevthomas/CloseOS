import { Outlet, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Menu } from 'lucide-react'
import { CRMAuthProvider, useCRMAuth } from '../contexts/CRMAuthContext'
import { CRMProspectsProvider } from '../contexts/CRMProspectsContext'
import { BusinessThemeProvider } from '../../business/contexts/BusinessThemeContext'
import { CRMSidebar } from '../components/CRMSidebar'
import { CRMSettingsModal } from '../components/CRMSettingsModal'

function CRMLayoutInner() {
  const navigate = useNavigate()
  const { loading, user, notACrmUser, crmProfile, authError } = useCRMAuth()

  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user) {
      navigate('/crm/login', { replace: true })
      return
    }
    if (notACrmUser) {
      navigate('/crm/login?reason=not-crm', { replace: true })
      return
    }
    // Remember product so the right loader shows on next refresh
    try { localStorage.setItem('closeos_product', 'crm') } catch {}
  }, [loading, user, notACrmUser, navigate])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="h-10 w-10 rounded-full border-4 border-[#3B82F6] border-t-transparent animate-spin" />
      </div>
    )
  }

  if (authError && !crmProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-extrabold text-[#111111] mb-3" style={{ fontFamily: 'Manrope, sans-serif' }}>Initialisation impossible</h1>
          <p className="text-sm text-[#444748] mb-4">
            La base CRM n'est pas accessible. La migration SQL <code className="bg-stone-100 px-1 rounded">20260422_crm_product.sql</code> doit être appliquée sur Supabase (table <code className="bg-stone-100 px-1 rounded">crm_users</code> manquante).
          </p>
          <button onClick={() => navigate('/crm')} className="px-5 py-2.5 rounded-full bg-[#111111] text-white text-sm font-bold">Retour</button>
        </div>
      </div>
    )
  }

  if (!user || !crmProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="h-10 w-10 rounded-full border-4 border-[#3B82F6] border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      <CRMSidebar
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        isCollapsed={collapsed}
        onCollapseChange={setCollapsed}
        onSettings={() => setSettingsOpen(true)}
      />

      {/* Spacer reserves space when sidebar is in floating/collapsed state on desktop.
          When expanded on desktop the sidebar is static (lg:static), so no spacer needed. */}
      <div
        aria-hidden
        className={`hidden lg:block flex-shrink-0 transition-all duration-300 ease-in-out ${collapsed ? 'w-[calc(5rem+2rem)]' : 'w-0'}`}
      />

      <main className="flex-1 flex flex-col overflow-auto min-w-0 relative">
        {/* Floating mobile menu trigger — no header on desktop */}
        <button
          className="lg:hidden fixed top-4 left-4 z-30 p-2.5 rounded-xl bg-white shadow-sm border border-stone-200"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Outlet />
      </main>

      <CRMSettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}

export function CRMLayout() {
  return (
    <BusinessThemeProvider>
      <CRMAuthProvider>
        <CRMProspectsProvider>
          <CRMLayoutInner />
        </CRMProspectsProvider>
      </CRMAuthProvider>
    </BusinessThemeProvider>
  )
}
