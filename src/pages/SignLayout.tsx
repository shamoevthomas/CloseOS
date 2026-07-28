import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Home, FileText, Users, Plus, LogOut, ShieldCheck, Menu, X, Settings, Briefcase } from 'lucide-react';
import { signOutSign, useSignOwner } from '../lib/signAuth';
import { supabase } from '../lib/supabase';
import { signSupabase } from '../lib/signSupabase';
import { SignLogo } from '../components/SignLogo';
import SignLangToggle from '../components/SignLangToggle';
import { useSignLang } from '../contexts/SignLangContext';
import { SignWhatsNewModal } from '../components/SignWhatsNewModal';

/**
 * CloseOS Sign — layout de l'espace connecté (DA Sign).
 * Menu en "bulle" flottante, détachée des bords, qui s'ouvre au survol d'un
 * hamburger flottant. Le contenu occupe toute la largeur.
 */

export default function SignLayout() {
  const navigate = useNavigate();
  const { lang } = useSignLang();
  const { loading, owner } = useSignOwner();

  const NAV = [
    { to: '/sign/app', label: lang === 'fr' ? 'Accueil' : 'Home', icon: Home, end: true },
    { to: '/sign/app/contrats', label: lang === 'fr' ? 'Tous les contrats' : 'All contracts', icon: FileText, end: false },
    { to: '/sign/app/contacts', label: lang === 'fr' ? 'Contacts' : 'Contacts', icon: Users, end: false },
    { to: '/sign/app/equipe', label: lang === 'fr' ? 'Mon équipe' : 'My team', icon: Briefcase, end: false },
  ];
  const user = owner?.name ?? '…';
  const [open, setOpen] = useState(false);
  const [hasBusiness, setHasBusiness] = useState(false);

  useEffect(() => {
    if (!loading && !owner) navigate('/sign/login', { replace: true });
  }, [loading, owner, navigate]);

  // L'utilisateur a-t-il aussi un compte CloseOS Business ? (même auth.uid())
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!owner?.id) { setHasBusiness(false); return; }
      const { data } = await signSupabase.from('business_users').select('id').eq('id', owner.id).maybeSingle();
      if (!cancelled) setHasBusiness(!!data);
    })();
    return () => { cancelled = true; };
  }, [owner?.id]);

  // Passage transparent vers CloseOS Business : transfert de la session (compte auth commun).
  const goToBusiness = async () => {
    try {
      const { data } = await signSupabase.auth.getSession();
      const s = data.session;
      if (s?.access_token && s?.refresh_token) {
        await supabase.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token });
      }
    } catch (e) {
      console.error('[sign] passage vers Business', e);
    }
    window.location.href = '/business/dashboard';
  };

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

      {/* Overlay plein écran — ferme le menu au tap en dehors (indispensable sur tactile) */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Menu flottant (hamburger + bulle au survol) */}
      <div
        className="fixed left-4 top-4 z-50"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {/* Hamburger */}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={lang === 'fr' ? 'Menu' : 'Menu'}
          className={`flex h-10 w-12 items-center justify-center rounded-xl border border-[#3A4242] bg-[#222828] text-[#F3F4F6] shadow-lg shadow-black/40 transition-colors hover:border-[#CEFF8F] hover:text-[#CEFF8F] ${open ? 'border-[#CEFF8F] text-[#CEFF8F]' : ''}`}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {/* Bulle */}
        <div
          className={`absolute left-0 top-full w-64 max-w-[calc(100vw-2rem)] pt-2 origin-top-left transition-all duration-200 ${
            open ? 'pointer-events-auto translate-y-0 scale-100 opacity-100' : 'pointer-events-none -translate-y-1 scale-95 opacity-0'
          }`}
        >
          <div className="flex flex-col gap-1 rounded-2xl border border-[#3A4242] bg-[#222828] p-3 shadow-2xl shadow-black/50">
            {/* Logo */}
            <button onClick={() => go('/sign/app')} className="mb-1 flex items-center px-2 py-1.5">
              <SignLogo className="text-sm" />
            </button>

            {/* Créer un nouveau contrat */}
            <button
              onClick={() => go('/sign/app/nouveau')}
              className="mb-1 flex items-center justify-center gap-2 rounded-xl bg-[#CEFF8F] px-4 py-2.5 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC]"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} /> {lang === 'fr' ? 'Créer un contrat' : 'Create a contract'}
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

            {/* Accès CloseOS Business — uniquement si l'utilisateur y a accès */}
            {hasBusiness && (
              <button
                onClick={goToBusiness}
                className="mt-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#A1A9A9] transition-colors hover:bg-[#191E1E] hover:text-white"
              >
                <Briefcase className="h-4 w-4" />
                {lang === 'fr' ? 'Accéder à CloseOS Business' : 'Go to CloseOS Business'}
              </button>
            )}

            {/* Toggle de langue */}
            <SignLangToggle className="mt-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#A1A9A9] transition-colors hover:bg-[#191E1E] hover:text-white" />

            {/* Bas */}
            <div className="mt-2 border-t border-[#3A4242] pt-3">
              <div className="mb-2 flex items-center gap-2 px-2 text-[10px] text-[#A1A9A9]">
                <ShieldCheck className="h-3.5 w-3.5 text-[#CEFF8F]" /> {lang === 'fr' ? 'Sécurisé & RGPD' : 'Secure & GDPR'}
              </div>
              <div className="flex items-center justify-between rounded-xl border border-[#3A4242] bg-[#191E1E] px-3 py-2">
                <button
                  onClick={() => go('/sign/app/profil')}
                  title={lang === 'fr' ? 'Mon profil' : 'My profile'}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left transition-opacity hover:opacity-80"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#CEFF8F] text-xs font-bold text-[#191E1E]">
                    {user.slice(0, 1)}
                  </div>
                  <span className="truncate text-sm text-[#F3F4F6]">{user}</span>
                </button>
                <div className="flex items-center gap-1 pl-2">
                  <button onClick={() => go('/sign/app/profil?tab=parametres')} title={lang === 'fr' ? 'Paramètres' : 'Settings'} className="text-[#A1A9A9] transition-colors hover:text-white">
                    <Settings className="h-4 w-4" />
                  </button>
                  <button onClick={handleLogout} title={lang === 'fr' ? 'Déconnexion' : 'Log out'} className="text-[#A1A9A9] transition-colors hover:text-white">
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu — sur mobile : pleine largeur, décalé vers le bas (le hamburger flotte
          en haut à gauche). Sur desktop : décalé à gauche pour laisser la place au menu. */}
      <main className="min-h-screen pt-16 md:pt-0 md:pl-20">
        <Outlet />
      </main>

      <SignWhatsNewModal />
    </div>
  );
}
