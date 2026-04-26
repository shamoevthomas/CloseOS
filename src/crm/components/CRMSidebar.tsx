import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, Kanban, Megaphone, TrendingUp, Plug, Settings, LogOut, X, Package } from 'lucide-react'
import { useEffect, useCallback, useRef } from 'react'
import { useCRMAuth } from '../contexts/CRMAuthContext'

interface CRMSidebarProps {
  isOpen?: boolean
  onClose?: () => void
  onSettings?: () => void
  isCollapsed?: boolean
  onCollapseChange?: (collapsed: boolean) => void
}

const NAV_ITEMS = [
  { to: '/crm/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/crm/contacts', icon: Users, label: 'CRM' },
  { to: '/crm/pipeline', icon: Kanban, label: 'Pipeline' },
  { to: '/crm/offres', icon: Package, label: 'Offres' },
  { to: '/crm/campagnes', icon: Megaphone, label: 'Campagnes' },
  { to: '/crm/acquisition', icon: TrendingUp, label: 'Acquisition' },
  { to: '/crm/integrations', icon: Plug, label: 'Intégrations' },
]

export function CRMSidebar({ isOpen, onClose, onSettings, isCollapsed, onCollapseChange }: CRMSidebarProps) {
  const navigate = useNavigate()
  const { logout, crmProfile } = useCRMAuth()
  const sidebarRef = useRef<HTMLDivElement>(null)

  // Auto-collapse on desktop after 3s
  useEffect(() => {
    if (typeof window === 'undefined' || window.innerWidth < 1024) return
    const timer = setTimeout(() => onCollapseChange?.(true), 3000)
    return () => clearTimeout(timer)
  }, [])

  const handleMouseEnter = useCallback(() => {
    if (window.innerWidth < 1024) return
    onCollapseChange?.(false)
  }, [onCollapseChange])

  const handleMouseLeave = useCallback(() => {
    if (window.innerWidth < 1024) return
    onCollapseChange?.(true)
  }, [onCollapseChange])

  const collapsed = !!isCollapsed && typeof window !== 'undefined' && window.innerWidth >= 1024

  const fullName: string = crmProfile?.full_name || crmProfile?.email?.split('@')[0] || 'User'
  const initials = fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  const onNavClick = () => { if (onClose && window.innerWidth < 1024) onClose() }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}

      <div
        ref={sidebarRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`fixed z-50 flex flex-col transition-all duration-300 ease-in-out ${
          collapsed
            ? 'lg:fixed lg:left-4 lg:top-4 lg:h-[calc(100vh-2rem)] lg:w-20 lg:rounded-[3rem] lg:border lg:border-blue-100 lg:items-center lg:py-4 bg-white shadow-[0_20px_40px_rgba(27,28,27,0.04)]'
            : 'shadow-[0_20px_40px_rgba(27,28,27,0.04)] backdrop-blur-xl inset-y-0 left-0 lg:static lg:h-screen lg:w-72 bg-white/80 border-r border-blue-100/60'
        } ${isOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Header */}
        <div className={`flex items-center transition-all duration-300 ${
          collapsed ? 'mb-4 justify-center w-full' : 'h-[72px] border-b border-blue-100/60 px-6 gap-3'
        }`}>
          {collapsed ? (
            <button onClick={() => navigate('/crm/dashboard')} className="flex items-center justify-center">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl text-white font-black text-lg shrink-0"
                style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%)' }}>
                C
              </span>
            </button>
          ) : (
            <>
              <button onClick={() => navigate('/crm/dashboard')} className="flex items-center gap-2 font-extrabold text-xl tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-white font-black shrink-0"
                  style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%)' }}>C</span>
                <span className="text-[#0A0E27]">
                  Close<span style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>OS</span>
                  <span className="text-[10px] ml-1 font-bold uppercase tracking-widest" style={{ color: '#3B82F6' }}>CRM</span>
                </span>
              </button>
              <button onClick={onClose} className="lg:hidden ml-auto p-2 text-stone-400 hover:text-[#0A0E27]">
                <X className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        {/* Navigation */}
        <nav className={`flex-1 overflow-y-auto space-y-1 ${collapsed ? 'w-full flex flex-col items-center px-0 py-2 gap-1' : 'py-4 px-4'}`}>
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onNavClick}
              title={collapsed ? label : undefined}
              className={({ isActive }) => `${
                collapsed
                  ? `w-12 h-12 flex items-center justify-center rounded-xl transition-colors ${isActive ? 'bg-gradient-to-br from-[#dbeafe] to-[#bfdbfe] text-[#0A0E27]' : 'text-stone-500 hover:bg-blue-50'}`
                  : `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? 'bg-gradient-to-r from-[#dbeafe] to-[#bfdbfe] text-[#0A0E27]' : 'text-stone-600 hover:bg-blue-50/60'}`
              }`}
            >
              <Icon className={collapsed ? 'h-5 w-5 shrink-0' : 'h-4 w-4 shrink-0'} />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer actions */}
        <div className={`border-t border-blue-100/60 ${collapsed ? 'pt-4 mt-2 flex flex-col items-center gap-3 w-full pb-4' : 'pt-4 pb-4 px-4 space-y-1'}`}>
          <button
            onClick={onSettings || (() => navigate('/crm/integrations'))}
            title={collapsed ? 'Paramètres' : undefined}
            className={collapsed
              ? 'w-12 h-12 flex items-center justify-center rounded-xl text-stone-500 hover:bg-blue-50 transition-colors'
              : 'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-600 hover:bg-blue-50/60 transition-colors'}
          >
            <Settings className={collapsed ? 'h-5 w-5' : 'h-4 w-4 shrink-0'} />
            {!collapsed && <span>Paramètres</span>}
          </button>
          <button
            onClick={async () => { await logout(); navigate('/crm') }}
            title={collapsed ? 'Déconnexion' : undefined}
            className={collapsed
              ? 'w-12 h-12 flex items-center justify-center rounded-xl text-stone-500 hover:bg-red-50 hover:text-red-600 transition-colors'
              : 'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-600 hover:bg-red-50 hover:text-red-600 transition-colors'}
          >
            <LogOut className={collapsed ? 'h-5 w-5' : 'h-4 w-4 shrink-0'} />
            {!collapsed && <span>Déconnexion</span>}
          </button>

          {/* User card */}
          {collapsed ? (
            <div
              className="mt-2 h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
              style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%)' }}
              title={fullName}
            >
              {initials}
            </div>
          ) : (
            <div className="mt-2 pt-3 border-t border-blue-100/60 flex items-center gap-2 px-2">
              <div className="h-9 w-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%)' }}>
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#0A0E27] truncate">{fullName}</p>
                <p className="text-[10px] text-stone-500 truncate">{crmProfile?.email}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
