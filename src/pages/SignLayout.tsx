import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Home, FileText, Users, Plus, LogOut, ShieldCheck, Menu, X, Settings } from 'lucide-react';
import { signOutSign, useSignOwner } from '../lib/signAuth';

/**
 * CloseOS Sign — layout de l'espace connecté (DA Sign).
 * Menu en "bulle" flottante, détachée des bords, qui s'ouvre au survol d'un
 * hamburger flottant. Le contenu occupe toute la largeur.
 */

const Logo = ({ className = '' }: { className?: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" />
    <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const NAV = [
  { to: '/sign/app', label: 'Accueil', icon: Home, end: true },
  { to: '/sign/app/contrats', label: 'Tous les contrats', icon: FileText, end: false },
  { to: '/sign/app/contacts', label: 'Contacts', icon: Users, end: false },
];

export default function SignLayout() {
  const navigate = useNavigate();
  const { loading, owner } = useSignOwner();
  const user = owner?.name ?? '…';
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && !owner) navigate('/sign/login', { replace: true });
  }, [loading, owner, navigate]);

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  const handleLogout = async () => {
    await signOutSign();
    navigate('/sign/login', { replace: true });
  };

  return (
    <div className="sign-landing relative min-h-screen bg-[#191E1E] font-sans text-[#F3F4F6] antialiased selection:bg-[#CEFF8F] selection:text-[#191E1E]">
      <style>{`.sign-landing { font-family: "SF Pro Display","Helvetica Neue",Helvetica,Arial,Inter,sans-serif; }`}</style>

      {/* Menu flottant (hamburger + bulle au survol) */}
      <div
        className="fixed left-4 top-4 z-50"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {/* Hamburger */}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
          className={`flex h-10 w-12 items-center justify-center rounded-xl border border-[#3A4242] bg-[#222828] text-[#F3F4F6] shadow-lg shadow-black/40 transition-colors hover:border-[#CEFF8F] hover:text-[#CEFF8F] ${open ? 'border-[#CEFF8F] text-[#CEFF8F]' : ''}`}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {/* Bulle */}
        <div
          className={`absolute left-0 top-full w-64 pt-2 origin-top-left transition-all duration-200 ${
            open ? 'pointer-events-auto translate-y-0 scale-100 opacity-100' : 'pointer-events-none -translate-y-1 scale-95 opacity-0'
          }`}
        >
          <div className="flex flex-col gap-1 rounded-2xl border border-[#3A4242] bg-[#222828] p-3 shadow-2xl shadow-black/50">
            {/* Logo */}
            <button onClick={() => go('/sign/app')} className="mb-1 flex items-center px-2 py-1.5">
              <Logo className="text-[#CEFF8F]" />
              <span className="ml-2 text-sm font-semibold tracking-tight text-white">
                CloseOS <span className="font-normal text-[#A1A9A9]">| Sign</span>
              </span>
            </button>

            {/* Créer un nouveau contrat */}
            <button
              onClick={() => go('/sign/app/nouveau')}
              className="mb-1 flex items-center justify-center gap-2 rounded-xl bg-[#CEFF8F] px-4 py-2.5 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC]"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} /> Créer un contrat
            </button>

            {/* Navigation */}
            <nav className="flex flex-col gap-0.5">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive ? 'bg-[#CEFF8F]/10 text-[#CEFF8F]' : 'text-[#A1A9A9] hover:bg-[#191E1E] hover:text-white'
                    }`
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
            </nav>

            {/* Bas */}
            <div className="mt-2 border-t border-[#3A4242] pt-3">
              <div className="mb-2 flex items-center gap-2 px-2 text-[10px] text-[#A1A9A9]">
                <ShieldCheck className="h-3.5 w-3.5 text-[#CEFF8F]" /> eIDAS &amp; RGPD
              </div>
              <div className="flex items-center justify-between rounded-xl border border-[#3A4242] bg-[#191E1E] px-3 py-2">
                <button
                  onClick={() => go('/sign/app/profil')}
                  title="Mon profil"
                  className="flex min-w-0 flex-1 items-center gap-2 text-left transition-opacity hover:opacity-80"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#CEFF8F] text-xs font-bold text-[#191E1E]">
                    {user.slice(0, 1)}
                  </div>
                  <span className="truncate text-sm text-[#F3F4F6]">{user}</span>
                </button>
                <div className="flex items-center gap-1 pl-2">
                  <button onClick={() => go('/sign/app/profil?tab=parametres')} title="Paramètres" className="text-[#A1A9A9] transition-colors hover:text-white">
                    <Settings className="h-4 w-4" />
                  </button>
                  <button onClick={handleLogout} title="Déconnexion" className="text-[#A1A9A9] transition-colors hover:text-white">
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu — pleine largeur, décalé pour ne pas passer sous le hamburger */}
      <main className="min-h-screen pl-16 md:pl-20">
        <Outlet />
      </main>
    </div>
  );
}
