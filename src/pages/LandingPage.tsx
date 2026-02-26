import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Cal, { getCalApi } from "@calcom/embed-react";
import { PricingComparisonTable } from '../components/PricingComparisonTable';
import {
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  Zap,
  BarChart3,
  ChevronRight,
  XCircle,
  MessageSquare,
  FileText,
  Smartphone,
  BrainCircuit,
  CalendarCheck,
  LayoutDashboard,
  Phone,
  Star,
  ShieldCheck,
  Database,
  Video,
  Users,
  Building2,
  PlusCircle,
  Sheet,
  Clock,
  X,
  Menu,
} from 'lucide-react'

function FAQItem({ question, children }: { question: string, children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-white/5 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-4 py-4 text-left hover:text-white transition-colors group"
      >
        <span className="font-bold text-lg text-slate-200 group-hover:text-white transition-colors">
          {question}
        </span>
        <div className={`p-2 rounded-full border border-white/10 bg-white/5 transition-all duration-300 ${isOpen ? 'rotate-180 bg-blue-600 border-blue-500' : 'group-hover:bg-white/10'}`}>
          <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-white transition-colors" />
        </div>
      </button>
      <div
        className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100 pb-6' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          <div className="text-slate-400 leading-relaxed text-sm pr-12">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  // État pour le cycle de facturation
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Fonction pour calculer le prix (arrondi) avec -15% si annuel
  const calculatePrice = (price: number) => {
    if (billingCycle === 'yearly') {
      return Math.round(price * 0.85);
    }
    return price;
  };

  useEffect(() => {
    (async function () {
      const cal = await getCalApi({ "namespace": "demo-closeos-decouvrez-la-plateforme" });
      cal("ui", { "theme": "dark", "hideEventTypeDetails": false, "layout": "month_view" });
    })();
  }, [])

  useEffect(() => {
    const s = document.createElement('script');
    s.src = '/chatbot-widget.js';
    s.setAttribute('data-chatbot-id', 'acb35233-a6de-4738-9ba0-7e25c82c2a61');
    s.setAttribute('data-supabase-url', 'https://mkxcircbzcsjamslijde.supabase.co');
    s.setAttribute('data-supabase-key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1reGNpcmNiemNzamFtc2xpamRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MjM0MDAsImV4cCI6MjA4NzQ5OTQwMH0.9-abq1tEFsmjfRkLJjrkXlG3z-9o2HKYjyp5eBIl178');
    document.body.appendChild(s);

    return () => {
      if (document.body.contains(s)) {
        document.body.removeChild(s);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans selection:bg-blue-500/30 overflow-x-hidden">

      {/* BANDEAU OFFRE */}
      <div className="fixed top-0 z-[60] w-full bg-blue-600 py-2.5 text-center text-xs sm:text-sm font-bold text-white shadow-lg animate-in slide-in-from-top duration-500">
        🚀 OFFRE DE PRÉLANCEMENT : Rejoignez les Founders pour 29€/mois à VIE (au lieu de 69€).
        <span className="hidden sm:inline"> L'essai gratuit débutera au lancement officiel.</span>
      </div>

      {/* NAVBAR */}
      <nav className="fixed top-[40px] z-50 w-full border-b border-white/5 bg-[#020617]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <img src="/logo.PNG" alt="CloseOS Logo" className="h-8 w-auto" />
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Fonctionnalités</a>
            <a href="#integrations" className="hover:text-white transition-colors">Intégrations</a>
            <a href="#comparison" className="hover:text-white transition-colors">Comparatif</a>
            <a href="#pricing" className="text-white font-semibold transition-colors">Tarifs</a>
            <a href="#demo" className="hover:text-white transition-colors">Démo</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to={`/checkout?billing=${billingCycle}`}
              className="hidden sm:flex group items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-bold text-slate-950 transition-all hover:bg-blue-50 hover:scale-105 active:scale-95"
            >
              Devenir Founder
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            {/* Hamburger mobile */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5 text-white" /> : <Menu className="h-5 w-5 text-white" />}
            </button>
          </div>
        </div>

        {/* Menu mobile déroulant */}
        <div
          className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${mobileMenuOpen ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'
            }`}
        >
          <div className="border-t border-white/5 bg-[#020617]/95 backdrop-blur-xl px-6 py-4 flex flex-col gap-1">
            {[
              { href: '#features', label: 'Fonctionnalités' },
              { href: '#integrations', label: 'Intégrations' },
              { href: '#comparison', label: 'Comparatif' },
              { href: '#pricing', label: 'Tarifs' },
              { href: '#demo', label: 'Démo' },
              { href: '#faq', label: 'FAQ' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="py-3 px-4 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                {item.label}
              </a>
            ))}
            <div className="mt-2 pt-3 border-t border-white/5">
              <Link
                to={`/checkout?billing=${billingCycle}`}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-white text-slate-950 font-bold text-sm hover:bg-blue-50 transition-colors"
              >
                Devenir Founder
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative pt-40 pb-20 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-blue-600/20 opacity-30 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />
        <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-purple-600/10 opacity-20 blur-[100px] rounded-full pointer-events-none mix-blend-screen" />

        <div className="relative mx-auto max-w-7xl px-6 text-center z-10">

          {/* 👇 AJOUT : BADGE ENVIRONNEMENT */}
          <div className="flex justify-center mb-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition-colors cursor-default">
              🌱 Engagé pour l'environnement
            </div>
          </div>

          {/* 👇 MODIFICATION : DOUBLE BULLE AVEC RGPD */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300 hover:bg-blue-500/20 transition-colors cursor-default">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              Le Système d'Exploitation des Closers
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition-colors cursor-default">
              <ShieldCheck className="h-3.5 w-3.5" />
              100% RGPD & Sécurisé
            </div>
          </div>



          <h1 className="mx-auto max-w-5xl text-5xl font-extrabold tracking-tight text-white sm:text-7xl mb-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
            Arrêtez de gérer.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 animate-gradient-x">
              Commencez à encaisser.
            </span>
          </h1>

          <p className="mx-auto max-w-2xl text-lg text-slate-400 mb-10 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200 leading-relaxed">
            CRM, Agenda, Booking, VoIP, Facturation, Visio, KPIs... CloseOS réunit TOUT ce dont vous avez besoin pour closer davantage, et gagner plus.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
            <Link
              to={`/checkout?billing=${billingCycle}`}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-blue-600 text-white font-bold text-lg hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-1 flex items-center justify-center gap-2"
            >
              <Zap className="h-5 w-5 fill-current" />
              Profiter de l'offre Founder
            </Link>
            <a href="#demo" className="text-sm text-slate-500 hover:text-slate-300 underline transition-colors">
              Voir la démo d'abord
            </a>
          </div>

          <p className="text-xs text-slate-500 mt-3">
            🔒 Offre Founder = tarif 29€/mois bloqué à vie. Prix normal : 69€/mois après lancement.
          </p>

          {/* 👇 AJOUT : SOCIAL PROOF AVEC VRAIES PHOTOS */}
          <div className="mt-8 flex items-center justify-center gap-3 text-sm font-medium text-slate-400 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500">
            <div className="flex -space-x-3">
              {[
                "https://api.dicebear.com/7.x/avataaars/svg?seed=closer1",
                "https://api.dicebear.com/7.x/avataaars/svg?seed=closer2",
                "https://api.dicebear.com/7.x/avataaars/svg?seed=closer3",
                "https://api.dicebear.com/7.x/avataaars/svg?seed=closer4",
                "https://api.dicebear.com/7.x/avataaars/svg?seed=closer5"
              ].map((src, i) => (
                <div key={i} className="h-8 w-8 rounded-full border-2 border-[#020617] relative z-0 hover:z-10 transition-all hover:scale-110">
                  <img src={src} alt="Closer" className="h-full w-full rounded-full object-cover" />
                </div>
              ))}
            </div>
            <div className="flex flex-col text-left">
              <div className="flex text-amber-400 gap-0.5">
                {[...Array(5)].map((_, i) => <Star key={i} className="h-3 w-3 fill-current" />)}
              </div>
              <span>Produit validé par <strong className="text-white">+70 closers</strong></span>
            </div>
          </div>

        </div>
      </section>

      {/* INTEGRATIONS BANNER */}
      <section id="integrations" className="py-12 border-y border-white/5 bg-slate-950/50">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <p className="text-xs font-bold text-slate-500 mb-8 uppercase tracking-widest">
            Synchronisation native avec vos outils préférés
          </p>
          <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-8 opacity-60 grayscale hover:grayscale-0 transition-all duration-700">
            <div className="flex items-center gap-2 font-bold text-xl sm:text-2xl text-white">iClosed</div>
            <div className="flex items-center gap-2 font-bold text-xl sm:text-2xl text-white">Hubspot</div>
            <div className="flex items-center gap-2 font-bold text-xl sm:text-2xl text-white">Pipedrive</div>
            <div className="flex items-center gap-2 font-bold text-xl sm:text-2xl text-white"><span className="text-[#4285F4]">Google</span> Calendar</div>
            <div className="flex items-center gap-2 font-bold text-xl sm:text-2xl text-white"><span className="text-[#F22F46]">Twilio</span></div>
            <div className="flex items-center gap-2 font-bold text-xl sm:text-2xl text-white">Cal.com</div>
            <div className="flex items-center gap-2 font-bold text-xl sm:text-2xl text-white"><span className="text-[#635BFF]">Stripe</span></div>
          </div>
        </div>
      </section>

      {/* FEATURES GRID */}
      <section id="features" className="py-32 relative">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-20 text-center max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-white sm:text-5xl mb-6">Tout est là.<br />Au même endroit.</h2>
            <p className="text-lg text-slate-400">
              Arrêtez de perdre du temps à switcher entre les onglets. CloseOS centralise votre flux de travail pour que vous puissiez vous concentrer sur l'essentiel : <span className="text-emerald-400 font-semibold">Le Closing.</span>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 rounded-3xl border border-slate-800 bg-slate-900/50 p-8 hover:border-blue-500/30 transition-all duration-500 group overflow-hidden relative hover:bg-slate-900/80">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-20 transition-opacity duration-500 transform group-hover:scale-110">
                <LayoutDashboard className="w-64 h-64 text-blue-500" />
              </div>
              <div className="relative z-10">
                <div className="h-12 w-12 rounded-lg bg-blue-500/20 flex items-center justify-center mb-6 ring-1 ring-blue-500/30">
                  <BarChart3 className="h-6 w-6 text-blue-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Cockpit & KPIs en Temps Réel</h3>
                <p className="text-slate-400 mb-6 max-w-md leading-relaxed">
                  Votre centre de commandement. Visualisez instantanément vos commissions, votre taux de conversion, et votre pipeline. Si votre performance baisse, vous le voyez tout de suite.
                </p>
                <ul className="grid grid-cols-2 gap-2">
                  <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Cash encaissé</li>
                  <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Taux de closing</li>
                  <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Commissions prévisionnelles</li>
                  <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Deals en cours</li>
                </ul>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-8 hover:border-[#25D366]/30 transition-all duration-500 group hover:bg-slate-900/80 relative overflow-hidden">
              <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <MessageSquare className="w-32 h-32 text-[#25D366]" />
              </div>
              <div className="h-12 w-12 rounded-lg bg-[#25D366]/20 flex items-center justify-center mb-6 ring-1 ring-[#25D366]/30">
                <Phone className="h-6 w-6 text-[#25D366]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Téléphonie VoIP & Click-to-WhatsApp</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                Appelez vos prospects en un clic via Twilio (appels enregistrés).
                Lancez vos conversations WhatsApp instantanément sans enregistrer le numéro.
                <span className="block mt-2 text-[#25D366] text-xs font-bold uppercase tracking-wide">
                  🚀 Zéro friction au quotidien
                </span>
              </p>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-8 hover:border-orange-500/30 transition-all duration-500 group hover:bg-slate-900/80">
              <div className="h-12 w-12 rounded-lg bg-orange-500/20 flex items-center justify-center mb-6 ring-1 ring-orange-500/30">
                <TrendingUp className="h-6 w-6 text-orange-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Pipeline & Offres</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                Vue Kanban fluide. Configurez vos offres (prix, commissions, formules) et laissez l'outil calculer vos gains à chaque deal déplacé.
              </p>
            </div>

            <div className="md:col-span-2 rounded-3xl border border-slate-800 bg-slate-900/50 p-8 hover:border-purple-500/30 transition-all duration-500 group overflow-hidden relative hover:bg-slate-900/80">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-20 transition-opacity duration-500 transform group-hover:rotate-12 group-hover:scale-110">
                <CalendarCheck className="w-64 h-64 text-purple-500" />
              </div>
              <div className="relative z-10">
                <div className="h-12 w-12 rounded-lg bg-purple-500/20 flex items-center justify-center mb-6 ring-1 ring-purple-500/30">
                  <CalendarCheck className="h-6 w-6 text-purple-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Agenda & Booking (Google Calendar)</h3>
                <p className="text-slate-400 mb-6 max-w-md leading-relaxed">
                  Connectez votre Google Calendar. Vos rendez-vous et créneaux de booking remontent automatiquement dans votre Pipeline et votre Agenda CloseOS.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300">Sync Bi-directionnelle</span>
                  <span className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300">Intégration native</span>
                  <span className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300">Centralisation</span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-8 hover:border-emerald-500/30 transition-all duration-500 group hover:bg-slate-900/80">
              <div className="h-12 w-12 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-6 ring-1 ring-emerald-500/30">
                <FileText className="h-6 w-6 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Facturation Auto & Paiement CB</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Générez vos factures de commissions en un clic. Créez des liens de paiement CB sécurisés et envoyez automatiquement la facture à votre infopreneur.
              </p>
            </div>

            <div className="md:col-span-2 rounded-3xl border border-slate-800 bg-slate-900/50 p-8 hover:border-[#E11D48]/30 transition-all duration-500 group overflow-hidden relative hover:bg-slate-900/80">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-20 transition-opacity duration-500">
                <Zap className="w-64 h-64 text-[#E11D48]" />
              </div>
              <div className="relative z-10">
                <div className="h-12 w-12 rounded-lg bg-[#E11D48]/20 flex items-center justify-center mb-6 ring-1 ring-[#E11D48]/30">
                  <Zap className="h-6 w-6 text-[#E11D48]" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Sync CRM (HubSpot, Pipedrive, iClosed)</h3>
                <p className="text-slate-400 mb-6 max-w-lg leading-relaxed">
                  Synchronisation native avec iClosed, HubSpot et Pipedrive. Vos leads et vos deals circulent en temps réel. Oubliez la double saisie manuelle et automatisez 100% de votre suivi.
                  <span className="block mt-2 text-xs text-slate-500 italic">
                    (PS: pour iClosed, voir la FAQ)
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ROADMAP TIMELINE — HORIZONTAL */}
      <section className="py-20 bg-[#0B1121] border-t border-white/5 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-indigo-600/8 blur-[150px] rounded-full pointer-events-none" />
        <div className="mx-auto max-w-7xl px-6 relative z-10">
          <div className="text-center mb-12">
            <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-bold text-indigo-400 uppercase tracking-widest">
              Roadmap 2025
            </span>
            <h2 className="text-3xl sm:text-5xl font-bold text-white mt-6">Le Futur du Closing</h2>
            <p className="text-slate-400 mt-4 max-w-2xl mx-auto text-sm">Notre vision pour faire de CloseOS le système d'exploitation incontournable des closers, agences et infopreneurs.</p>
          </div>

          {/* Horizontal scrollable timeline — alternating top/bottom */}
          <div className="overflow-x-auto pb-4 -mx-6 px-6 scrollbar-hide">
            <div className="relative min-w-[900px]" style={{ height: '340px' }}>
              {/* Horizontal line — centered vertically */}
              <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-blue-500/60 via-purple-500/60 via-amber-500/60 to-emerald-500/60" style={{ top: '50%' }} />

              <div className="flex justify-between items-stretch h-full">

                {/* Q1 — BELOW */}
                <div className="relative flex flex-col items-center" style={{ width: '14%' }}>
                  <div className="absolute left-1/2 -translate-x-1/2 z-10 w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center text-white text-xs font-black shadow-lg shadow-blue-500/30 border-2 border-blue-400/40 ring-4 ring-[#0B1121]" style={{ top: 'calc(50% - 28px)' }}>
                    Q1
                  </div>
                  <div className="absolute left-0 right-0 px-1" style={{ top: 'calc(50% + 36px)' }}>
                    <div className="group p-3 rounded-xl bg-slate-900/80 border border-blue-500/20 hover:border-blue-500/40 transition-all duration-300 text-center">
                      <Zap className="h-4 w-4 text-blue-400 mx-auto mb-1.5" />
                      <h3 className="font-bold text-white text-[11px] leading-tight">Lancement CloseOS</h3>
                      <p className="text-[10px] text-slate-500 mt-1">CRM, Pipeline, VoIP, KPIs...</p>
                      <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
                      </div>
                    </div>
                  </div>
                </div>

                {/* Q2 Début — ABOVE */}
                <div className="relative flex flex-col items-center" style={{ width: '14%' }}>
                  <div className="absolute left-1/2 -translate-x-1/2 z-10 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white text-[9px] font-black shadow-lg shadow-indigo-500/30 border-2 border-indigo-400/40 ring-4 ring-[#0B1121]" style={{ top: 'calc(50% - 28px)' }}>
                    Q2
                  </div>
                  <div className="absolute left-0 right-0 px-1" style={{ bottom: 'calc(50% + 36px)' }}>
                    <div className="group p-3 rounded-xl bg-slate-900/80 border border-indigo-500/20 hover:border-indigo-500/40 transition-all duration-300 text-center">
                      <Building2 className="h-4 w-4 text-indigo-400 mx-auto mb-1.5" />
                      <h3 className="font-bold text-white text-[11px] leading-tight">Interface Infopreneur</h3>
                      <p className="text-[10px] text-slate-500 mt-1">Gérez votre équipe de closers</p>
                      <span className="text-[9px] text-indigo-400 font-semibold uppercase">Début Q2</span>
                    </div>
                  </div>
                </div>

                {/* Q2 Milieu — BELOW */}
                <div className="relative flex flex-col items-center" style={{ width: '14%' }}>
                  <div className="absolute left-1/2 -translate-x-1/2 z-10 w-4 h-4 rounded-full bg-purple-500 ring-4 ring-[#0B1121]" style={{ top: 'calc(50% - 8px)' }} />
                  <div className="absolute left-0 right-0 px-1" style={{ top: 'calc(50% + 16px)' }}>
                    <div className="group p-3 rounded-xl bg-slate-900/80 border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300 text-center">
                      <Users className="h-4 w-4 text-purple-400 mx-auto mb-1.5" />
                      <h3 className="font-bold text-white text-[11px] leading-tight">Interface Agence</h3>
                      <p className="text-[10px] text-slate-500 mt-1">Gestion d'équipes</p>
                      <span className="text-[9px] text-purple-400 font-semibold uppercase">Milieu Q2</span>
                    </div>
                  </div>
                </div>

                {/* Q2 Fin — ABOVE */}
                <div className="relative flex flex-col items-center" style={{ width: '14%' }}>
                  <div className="absolute left-1/2 -translate-x-1/2 z-10 w-4 h-4 rounded-full bg-violet-500 ring-4 ring-[#0B1121]" style={{ top: 'calc(50% - 8px)' }} />
                  <div className="absolute left-0 right-0 px-1" style={{ bottom: 'calc(50% + 16px)' }}>
                    <div className="group p-3 rounded-xl bg-slate-900/80 border border-violet-500/20 hover:border-violet-500/40 transition-all duration-300 text-center">
                      <FileText className="h-4 w-4 text-violet-400 mx-auto mb-1.5" />
                      <h3 className="font-bold text-white text-[11px] leading-tight">Rapport de performance</h3>
                      <p className="text-[10px] text-slate-500 mt-1">Feedback sur appels</p>
                      <span className="text-[9px] text-violet-400 font-semibold uppercase">Fin Q2</span>
                    </div>
                  </div>
                </div>

                {/* Q3 — BELOW */}
                <div className="relative flex flex-col items-center" style={{ width: '14%' }}>
                  <div className="absolute left-1/2 -translate-x-1/2 z-10 w-14 h-14 rounded-full bg-gradient-to-br from-amber-600 to-orange-500 flex items-center justify-center text-white text-xs font-black shadow-lg shadow-amber-500/30 border-2 border-amber-400/40 ring-4 ring-[#0B1121]" style={{ top: 'calc(50% - 28px)' }}>
                    Q3
                  </div>
                  <div className="absolute left-0 right-0 px-1" style={{ top: 'calc(50% + 36px)' }}>
                    <div className="group p-3 rounded-xl bg-slate-900/80 border border-amber-500/20 hover:border-amber-500/40 transition-all duration-300 text-center">
                      <Smartphone className="h-4 w-4 text-amber-400 mx-auto mb-1.5" />
                      <h3 className="font-bold text-white text-[11px] leading-tight">App Mobile</h3>
                      <p className="text-[10px] text-slate-500 mt-1">iOS {'&'} Android</p>
                      <span className="text-[9px] text-amber-400 font-semibold uppercase">Milieu Q3</span>
                    </div>
                  </div>
                </div>

                {/* Q3 Fin — ABOVE */}
                <div className="relative flex flex-col items-center" style={{ width: '14%' }}>
                  <div className="absolute left-1/2 -translate-x-1/2 z-10 w-4 h-4 rounded-full bg-orange-500 ring-4 ring-[#0B1121]" style={{ top: 'calc(50% - 8px)' }} />
                  <div className="absolute left-0 right-0 px-1" style={{ bottom: 'calc(50% + 16px)' }}>
                    <div className="group p-3 rounded-xl bg-slate-900/80 border border-orange-500/20 hover:border-orange-500/40 transition-all duration-300 text-center">
                      <Database className="h-4 w-4 text-orange-400 mx-auto mb-1.5" />
                      <h3 className="font-bold text-white text-[11px] leading-tight">CRM Complet</h3>
                      <p className="text-[10px] text-slate-500 mt-1">Acquisition de leads</p>
                      <span className="text-[9px] text-orange-400 font-semibold uppercase">Fin Q3</span>
                    </div>
                  </div>
                </div>

                {/* Q4 — BELOW */}
                <div className="relative flex flex-col items-center" style={{ width: '14%' }}>
                  <div className="absolute left-1/2 -translate-x-1/2 z-10 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center text-white text-xs font-black shadow-lg shadow-emerald-500/30 border-2 border-emerald-400/40 ring-4 ring-[#0B1121]" style={{ top: 'calc(50% - 28px)' }}>
                    Q4
                  </div>
                  <div className="absolute left-0 right-0 px-1" style={{ top: 'calc(50% + 36px)' }}>
                    <div className="group p-3 rounded-xl bg-slate-900/80 border border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-300 text-center">
                      <MessageSquare className="h-4 w-4 text-emerald-400 mx-auto mb-1.5" />
                      <h3 className="font-bold text-white text-[11px] leading-tight">Messagerie Interne</h3>
                      <p className="text-[10px] text-slate-500 mt-1">Chat équipe intégré</p>
                      <span className="text-[9px] text-emerald-400 font-semibold uppercase">Q4</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS SECTION */}
      <section className="py-16 border-t border-white/5">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <p className="text-xs font-bold text-slate-500 mb-10 uppercase tracking-widest">Ce que disent les closers</p>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-slate-900/50 border border-white/5 p-6 text-left">
              <p className="text-slate-300 text-sm leading-relaxed">"Avant CloseOS je passais 2h par jour sur Excel et Notion. Maintenant tout est au même endroit, je me concentre uniquement sur mes appels."</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-400">A</div>
                <span className="text-sm font-semibold text-white">Antoine R. — Closer freelance</span>
              </div>
            </div>
            <div className="rounded-2xl bg-slate-900/50 border border-white/5 p-6 text-left">
              <p className="text-slate-300 text-sm leading-relaxed">"Le lien de partage KPI c'est ce qui m'a permis de décrocher mon deuxième contrat. L'infopreneur voyait mes stats en temps réel."</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-xs font-bold text-purple-400">S</div>
                <span className="text-sm font-semibold text-white">Sarah M. — Closer & Setter</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COMPARISON SECTION */}
      <section id="comparison" className="py-24 bg-slate-950/50 border-y border-white/5 relative overflow-hidden">
        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-96 h-96 bg-red-600/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute top-1/2 right-0 -translate-y-1/2 w-96 h-96 bg-blue-600/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="mx-auto max-w-7xl px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white sm:text-5xl">Vendez plus. Vivez mieux.</h2>
            <p className="text-slate-400 mt-4 text-lg">Pourquoi être "indépendant" si c'est pour être esclave de l'administratif ?</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">

            {/* 🔴 ANCIENNE METHODE */}
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-br from-red-500/20 to-transparent rounded-3xl blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
              <div className="relative rounded-3xl bg-[#0F0505] border border-red-900/30 p-8 h-full flex flex-col">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                    <XCircle className="w-6 h-6 text-red-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">Les "Obligations" Invisibles</h3>
                </div>

                <div className="space-y-4 flex-1">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-red-900/10 border border-red-900/20 text-sm">
                    <div className="flex items-center gap-3 text-red-200">
                      <Database className="w-4 h-4" /> Jonglage entre CRMs (HubSpot...)
                    </div>
                    <span className="font-bold text-red-400">Charge mentale</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-red-900/10 border border-red-900/20 text-sm">
                    <div className="flex items-center gap-3 text-red-200">
                      <Sheet className="w-4 h-4" /> Reporting KPI sur Google Sheet
                    </div>
                    <span className="font-bold text-red-400">Saisie Manuelle</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-red-900/10 border border-red-900/20 text-sm">
                    <div className="flex items-center gap-3 text-red-200">
                      <Phone className="w-4 h-4" /> Analyse d'appels / VoIP
                    </div>
                    <span className="font-bold text-red-400">Données dispersées</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-red-900/10 border border-red-900/20 text-sm">
                    <div className="flex items-center gap-3 text-red-200">
                      <FileText className="w-4 h-4" /> Facturation des commissions
                    </div>
                    <span className="font-bold text-red-400">Retards & Oublis</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-red-900/10 border border-red-900/20 text-sm opacity-80">
                    <div className="flex items-center gap-3 text-red-200">
                      <Clock className="w-4 h-4" /> Temps de gestion hebdo
                    </div>
                    <span className="font-bold text-red-400">~5h perdues</span>
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-red-900/30 text-center">
                  <div className="mb-6">
                    <div className="text-lg font-bold text-white">~150 kg <span className="text-sm font-normal text-slate-400">de CO2 émis / an</span></div>
                    <p className="text-[10px] text-red-300/70 mt-1 leading-tight">(Multitude d'interfaces chargées + Serveurs + RAM)</p>
                  </div>

                  <div className="pt-6 border-t border-red-900/30">
                    <p className="text-red-400 text-xs font-bold uppercase tracking-widest mb-1">PERTE ESTIMÉE</p>
                    {/* MODIFICATION 2 : 35H + SOUS-TITRE */}
                    <div className="text-4xl font-black text-white">
                      35h<span className="text-lg text-slate-500 font-medium">/mois</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 🔵 CloseOS */}
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-bl from-blue-500/20 to-purple-500/20 rounded-3xl blur opacity-30 group-hover:opacity-60 transition-opacity"></div>
              <div className="relative rounded-3xl bg-[#020617] border border-blue-500/30 p-8 h-full flex flex-col shadow-2xl shadow-blue-900/20">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full border border-blue-400 shadow-lg shadow-blue-600/50">
                  FOCUS CLOSING UNIQUEMENT
                </div>

                <div className="flex items-center gap-3 mb-8">
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <CheckCircle2 className="w-6 h-6 text-blue-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">La Clarté CloseOS</h3>
                </div>

                <div className="flex-1 bg-slate-900/50 rounded-2xl p-6 border border-white/5 space-y-6 flex flex-col justify-center">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white">ROI Immédiat</h4>
                      <p className="text-sm text-slate-400">1 seul deal de plus par mois rembourse largement l'outil pour l'année.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                      <BrainCircuit className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white">Cerveau Libéré</h4>
                      <p className="text-sm text-slate-400">Zéro saisie. CRM, KPIs et Factures se mettent à jour automatiquement après chaque appel.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                      <Star className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white">Image 100% Pro</h4>
                      <p className="text-sm text-slate-400">KPIs propres, factures en 1 clic, cockpit de bord. Travaillez comme le top 1%.</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-blue-500/20 text-center relative">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-blue-500/50 blur-[2px]"></div>

                  <div className="mb-6 group relative cursor-help">
                    <div className="text-lg font-bold text-white">~50 kg <span className="text-sm font-normal text-slate-400">de CO2 émis / an</span></div>
                    <p className="text-xs text-emerald-400/80 mt-1 leading-snug">
                      Économisez ~100 kg de CO2 par an. CloseOS consomme drastiquement moins de ressources serveur et de batterie que 10 onglets ouverts en permanence
                    </p>

                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-900 border border-slate-700 rounded-xl shadow-xl text-xs text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      Passer à CloseOS économise ~100 kg de CO2 par an et par closer. C'est l'équivalent de 600 km en voiture évités, juste en fermant vos onglets.
                      <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 border-b border-r border-slate-700 rotate-45"></div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-blue-500/20 relative z-10">
                    <p className="text-blue-400 text-sm font-medium uppercase tracking-widest mb-1">Offre Founder</p>
                    <div className="text-5xl font-black text-white tracking-tight">
                      29€<span className="text-lg text-slate-500 font-medium">/mois</span>
                    </div>
                    <p className="text-emerald-400 text-xs font-bold mt-2 flex items-center justify-center gap-1">
                      <Zap className="w-3 h-3" />
                      Récupérez 1h de vie / jour
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* PRICING SECTION */}
      <section id="pricing" className="py-32 relative bg-slate-950">
        <div className="mx-auto max-w-7xl px-6 relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white sm:text-5xl">Rejoignez l'Élite.</h2>
            <p className="text-slate-400 mt-4 text-lg">Choisissez l'outil qui va doubler votre taux de closing.</p>
            <p className="text-white mt-4 text-2xl font-bold">Essai gratuit 7 jours. Annulez à tout moment.</p>
          </div>

          <div className="flex flex-col items-center mb-12">
            {/* SWITCH MOIS / ANNÉE */}
            <div className="flex items-center justify-center gap-4">
              <span
                className={`text-sm font-medium cursor-pointer transition-colors ${billingCycle === 'monthly' ? 'text-white' : 'text-slate-500'}`}
                onClick={() => setBillingCycle('monthly')}
              >
                Mensuel
              </span>

              <button
                onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
                className="relative w-14 h-7 bg-slate-800 rounded-full p-1 transition-colors duration-200 focus:outline-none border border-slate-700"
              >
                <div
                  className={`w-5 h-5 bg-blue-600 rounded-full shadow-md transform transition-transform duration-200 ${billingCycle === 'yearly' ? 'translate-x-7' : 'translate-x-0'
                    }`}
                />
              </button>

              <span
                className={`text-sm font-medium cursor-pointer transition-colors flex items-center gap-2 ${billingCycle === 'yearly' ? 'text-white' : 'text-slate-500'}`}
                onClick={() => setBillingCycle('yearly')}
              >
                Annuel
                <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                  -15%
                </span>
              </span>
            </div>

            {/* BOUTON COMPARATIF */}
            <button
              onClick={() => setIsComparisonOpen(true)}
              className="mt-8 px-8 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-all border border-slate-700 hover:border-slate-600 flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200"
            >
              <Sheet className="h-5 w-5" />
              Voir le comparatif détaillé des offres
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start max-w-5xl mx-auto">
            {/* PLAN STARTER */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-8 flex flex-col h-full opacity-80 hover:opacity-100 transition-opacity animate-in fade-in zoom-in duration-300">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-white">PACK STARTER</h3>
                <p className="mt-2 text-slate-400 text-sm">Le système complet pour organiser votre closing et encaisser vos premières commissions.</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">{calculatePrice(39)}€</span>
                  <span className="text-slate-500">/mois</span>
                </div>
                {billingCycle === 'yearly' && (
                  <p className="text-xs text-emerald-400 mt-2">Facturé annuellement</p>
                )}
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex gap-3 text-sm text-slate-300">
                  <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0" />
                  <span><strong>CRM & Pipeline</strong> illimité</span>
                </li>
                <li className="flex gap-3 text-sm text-slate-300">
                  <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0" />
                  <span><strong>Agenda & Booking</strong> (Liens de rdv)</span>
                </li>
                <li className="flex gap-3 text-sm text-slate-300">
                  <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0" />
                  <span><strong>Facturation</strong> (Générateur PDF)</span>
                </li>
                <li className="flex gap-3 text-sm text-slate-300">
                  <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0" />
                  <span><strong>KPIs Globaux</strong> (CA, Ventes)</span>
                </li>
              </ul>
              <Link
                to={`/checkout-starter?billing=${billingCycle}`}
                className="w-full py-4 rounded-xl border border-slate-700 font-bold text-center text-slate-300 hover:bg-slate-800 hover:text-white transition-colors block"
              >
                Démarrer en Starter
              </Link>
              <p className="mt-3 text-[10px] text-center text-slate-600">
                1,5% de votre abonnement finance l'élimination du CO2 via Stripe Climate.
              </p>
            </div>

            {/* PLAN FOUNDER */}
            <div className="rounded-3xl border-2 border-blue-500 bg-blue-950/20 p-8 shadow-2xl shadow-blue-900/40 scale-105 relative z-10 flex flex-col h-full animate-in fade-in zoom-in duration-300 delay-75">
              <div className="absolute top-0 right-0 transform translate-x-2 -translate-y-2">
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                  OFFRE PRÉLANCEMENT
                </span>
              </div>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-2xl font-bold text-white">PACK FOUNDER</h3>
                  <Star className="h-5 w-5 text-yellow-400 fill-yellow-400 animate-pulse" />
                </div>
                <p className="mt-2 text-blue-200 text-sm">L'expérience ultime. Accès à vie, IA et communauté privée.</p>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-5xl font-extrabold text-white">{calculatePrice(29)}€</span>
                  <span className="text-slate-400 line-through text-lg">69€</span>
                  <span className="text-slate-500">/mois à vie</span>
                </div>
                {billingCycle === 'yearly' && (
                  <p className="text-xs text-emerald-400 mt-2">Facturé annuellement</p>
                )}
              </div>
              <ul className="space-y-4 mb-4 flex-1">
                <li className="flex gap-3 text-sm text-white font-medium">
                  <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span>Tout ce qui est inclus dans Starter</span>
                </li>
                <li className="flex gap-3 text-sm text-white font-medium">
                  <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span><strong>KPI Avancés</strong> (Evolution, Objectifs)</span>
                </li>
                <li className="flex gap-3 text-sm text-white font-medium">
                  <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span><strong>Call Room</strong> (Scripts & Notes)</span>
                </li>
                <li className="flex gap-3 text-sm text-white font-medium">
                  <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span><strong>Envoi Factures Automatique</strong></span>
                </li>
                <li className="flex gap-3 text-sm text-white font-medium">
                  <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span><strong>Automatisations</strong> (Sync CRM, etc.)</span>
                </li>
                <li className="flex gap-3 text-sm text-white font-medium">
                  <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span><strong>Enregistrement</strong> Vidéo/Audio</span>
                </li>
                <li className="flex gap-3 text-sm text-white font-medium">
                  <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span>Badge "Founder" & Support Prio</span>
                </li>
              </ul>

              <Link
                to={`/checkout?billing=${billingCycle}`}
                className="block w-full py-4 rounded-xl bg-blue-600 text-white font-bold text-center hover:bg-blue-50 transition-all shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40"
              >
                Sécuriser ma place à {calculatePrice(29)}€
              </Link>

              <p className="mt-4 text-xs text-center text-slate-500">
                Carte bancaire requise. <strong>Aucun prélèvement avant le lancement officiel</strong> + 7 jours d'essai offerts.
              </p>
              <p className="mt-3 text-[10px] text-center text-slate-500/60">
                1,5% de votre abonnement finance l'élimination du CO2 via Stripe Climate.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col md:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
            {/* Option VoIP */}
            <div className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-blue-900/20 border border-blue-500/30 shadow-lg shadow-blue-500/5">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <PlusCircle className="h-5 w-5 text-blue-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-white">Option VoIP & Enregistrements</p>
                <p className="text-xs text-blue-300">
                  Ajoutez la téléphonie à votre plan pour <span className="text-white font-bold">+{billingCycle === 'yearly' ? '7' : '10'}€/mois</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COMPARISON MODAL */}
      {isComparisonOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setIsComparisonOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors z-10"
            >
              <X className="h-6 w-6" />
            </button>
            <PricingComparisonTable isModal={true} />
            <div className="p-6 border-t border-slate-900 bg-slate-950/50 sticky bottom-0 text-center">
              <button
                onClick={() => setIsComparisonOpen(false)}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
              >
                Fermer le comparatif
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SECTION DEMO / CAL.COM --- */}
      <section id="demo" className="py-32 relative bg-slate-900/20 border-t border-white/5">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-sm font-medium text-blue-300 mb-6">
            <Video className="h-4 w-4" />
            Démo Personnalisée
          </div>
          <h2 className="text-3xl font-bold text-white sm:text-5xl mb-6">
            Voyez la machine en action.
          </h2>
          <p className="text-lg text-slate-400 mb-12 max-w-2xl mx-auto">
            Vous avez des doutes ? Prenez 15 min avec moi pour une démo en direct et on regarde ensemble comment CloseOS peut booster votre business.
          </p>

          <div className="rounded-3xl border border-slate-800 bg-[#020617] overflow-hidden shadow-2xl shadow-blue-500/10 h-[700px]">
            <Cal
              namespace="demo-closeos-decouvrez-la-plateforme"
              calLink="thomas-sh-ipdmni/demo-closeos-decouvrez-la-plateforme"
              style={{ width: "100%", height: "100%", overflow: "scroll" }}
              config={{ "layout": "month_view", "useSlotsViewOnSmallScreen": "true", "theme": "dark" }}
            />
          </div>

          <p className="mt-8 text-sm text-slate-500">
            Garanti 0% pression commerciale. 100% valeur ajoutée.
          </p>
        </div>
      </section>

      {/* --- FAQ SECTION --- */}
      <section id="faq" className="py-24 bg-slate-950 relative border-t border-white/5">
        <div className="mx-auto max-w-3xl px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">Questions Fréquentes</h2>
            <p className="text-slate-400 mt-4">Tout ce que vous devez savoir avant de commencer.</p>
          </div>

          <div className="space-y-4">
            <FAQItem question="Est-ce que je peux connecter Calendly ?">
              <p>
                <strong className="text-white">Non, et c'est un choix assumé.</strong> Calendly impose un abonnement payant pour permettre les intégrations, une pratique que nous trouvons injuste.
                Pour vous offrir la meilleure expérience sans surcoût, nous avons intégré <strong className="text-white">Cal.com</strong> (la référence Open Source).
              </p>
              <p className="mt-2">
                Résultat : vous profitez d'un système de booking ultra-performant, synchronisé à votre agenda, sans avoir à payer un abonnement "Pro" à Calendly juste pour qu'il accepte de parler à votre CRM.
              </p>
            </FAQItem>

            <FAQItem question="Comment CloseOS s'engage pour l'environnement ?">
              <p>Nous prônons la <strong className="text-emerald-400">"Performance Responsable"</strong>. Concrètement :</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><strong className="text-white">Sobriété numérique :</strong> En remplaçant 10 outils par 1 seul, nous réduisons la consommation d'énergie serveur nécessaire à votre activité.</li>
                <li><strong className="text-white">Action financière :</strong> Nous reversons automatiquement <strong className="text-white">1,5% de votre abonnement</strong> via <em>Stripe Climate</em> pour financer des technologies de pointe d'élimination du CO2. Closer avec nous, c'est aussi contribuer.</li>
              </ul>
            </FAQItem>

            <FAQItem question="Pourquoi payer CloseOS alors que je peux le faire moi-même sur Excel/Notion ?">
              <p>
                Parce que le "bricolage" vous coûte des ventes. Excel n'envoie pas de rappels automatiques, Notion ne génère pas vos liens de visio et ne synchronise pas vos appels.
              </p>
              <p className="mt-2">
                CloseOS n'est pas un simple tableau de note, c'est un <strong className="text-white">système actif</strong> qui élimine 80% de votre administratif. Le temps que vous ne passez plus à configurer vos outils est du temps réinvesti pour signer des contrats.
              </p>
            </FAQItem>

            <FAQItem question="Pourquoi l'offre Founder est-elle à 29€ au lieu de 69€ ?">
              <p>
                <strong className="text-white">C'est une offre de lancement limitée.</strong> Nous récompensons nos premiers utilisateurs ("Early Adopters") avec ce tarif préférentiel.
              </p>
              <p className="mt-2">
                En prenant votre accès aujourd'hui, vous <strong className="text-white">bloquez ce prix à vie</strong>. Même quand l'abonnement passera à 69€/mois pour les futurs clients, vous continuerez de payer 29€.
              </p>
            </FAQItem>

            <FAQItem question="Est-ce que iClosed est intégré ?">
              <p>
                <strong className="text-white">Partiellement.</strong> Contrairement aux standards du marché (HubSpot, Pipedrive), iClosed ne dispose pas d'une API publique ouverte permettant une synchronisation totale.
              </p>
              <p className="mt-2">
                <strong className="text-white">Concrètement :</strong> CloseOS reçoit bien vos nouveaux leads et vos ventes venant d'iClosed (via Webhook), mais ne peut pas aller modifier des informations <em>dans</em> iClosed. La synchronisation se fait donc à sens unique (iClosed vers CloseOS). (L'API arrivera Prochainement)
              </p>
            </FAQItem>
          </div>
        </div>
      </section>

      {/* --- CTA FINAL --- */}
      <section className="relative py-32 overflow-hidden">
        <div className="absolute inset-0 bg-blue-600/10 blur-[100px] rounded-full pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

        <div className="relative mx-auto max-w-4xl px-6 text-center z-10">
          <h2 className="text-4xl font-bold text-white mb-6">
            Arrêtez de payer pour 10 outils.<br />Commencez à closer.
          </h2>
          <p className="text-xl text-slate-300 mb-10">
            Rejoignez l'élite des closers qui utilisent le système tout-en-un CloseOS.
          </p>
          <div className="flex flex-col items-center justify-center gap-4">
            <Link
              to={`/checkout?billing=${billingCycle}`}
              className="w-full sm:w-auto px-10 py-4 rounded-full bg-white text-slate-950 font-bold text-lg hover:bg-blue-50 hover:scale-105 transition-all flex items-center justify-center gap-2 shadow-xl shadow-white/10"
            >
              Profiter de l'offre Founder ({calculatePrice(29)}€/mois)
              <ChevronRight className="h-5 w-5" />
            </Link>
            <Link
              to={`/checkout-starter?billing=${billingCycle}`}
              className="text-slate-500 hover:text-white text-sm underline transition-colors mt-2"
            >
              Ou démarrer avec le Pack Starter (39€/mois)
            </Link>
          </div>
          <p className="mt-6 text-sm text-slate-500">
            7 jours d'essai gratuit. Pas de prélèvement immédiat.
          </p>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="border-t border-white/5 bg-[#020617] py-12">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <img src="/logo.PNG" alt="CloseOS Logo" className="h-6 w-auto" />
          </div>

          <div className="flex flex-wrap justify-center gap-4 text-sm text-slate-500">
            <span>© 2026 CloseOS.fr</span>
            <span className="hidden sm:inline">•</span>
            <a href="/mentions-legales" className="hover:text-white transition-colors">Mentions Légales</a>
            <span className="hidden sm:inline">•</span>
            <a href="/cgu" className="hover:text-white transition-colors">CGV & CGU</a>
            <span className="hidden sm:inline">•</span>
            <a href="/confidentialite" className="hover:text-white transition-colors">Politique de Confidentialité</a>
          </div>

          <div className="flex gap-6">
            <a
              href="https://www.linkedin.com/in/thomas-shamoev-570885237/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-500 hover:text-white transition-colors"
            >
              LinkedIn
            </a>
            <a href="mailto:support@closeos.fr" className="text-slate-500 hover:text-white transition-colors">support@closeos.fr</a>
          </div>
        </div>
      </footer>
    </div >
  )
}