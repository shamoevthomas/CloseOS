import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Cal, { getCalApi } from "@calcom/embed-react";
import {
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  Zap,
  BarChart3,
  ChevronRight,
  Play,
  XCircle,
  LogIn,
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
  Clock
} from 'lucide-react'

export function LandingPage() {
  const [pricingTab, setPricingTab] = useState<'closer' | 'agency' | 'enterprise'>('closer');
  // État pour le cycle de facturation
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

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
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/login"
              className="group flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              <LogIn className="h-4 w-4 text-slate-500 group-hover:text-white transition-colors" />
              <span className="hidden sm:inline">Se connecter</span>
            </Link>
            <Link
              to={`/checkout?billing=${billingCycle}`}
              className="hidden sm:flex group items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-bold text-slate-950 transition-all hover:bg-blue-50 hover:scale-105 active:scale-95"
            >
              Devenir Founder
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative pt-40 pb-20 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-blue-600/20 opacity-30 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />
        <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-purple-600/10 opacity-20 blur-[100px] rounded-full pointer-events-none mix-blend-screen" />

        <div className="relative mx-auto max-w-7xl px-6 text-center z-10">

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
            Jongler entre 10 outils,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 animate-gradient-x">
              c'est terminé.
            </span>
            <br />
            Reprenez 1h de closing par jour.
          </h1>

          <p className="mx-auto max-w-2xl text-lg text-slate-400 mb-10 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200 leading-relaxed">
            CRM, Agenda, Booking, VoIP, Facturation, Visio, KPIs...<br />
            <strong className="text-white">CloseOS</strong> réunit TOUT ce dont vous avez besoin pour closer dans une seule interface.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
            <Link
              to={`/checkout?billing=${billingCycle}`}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-blue-600 text-white font-bold text-lg hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-1 flex items-center justify-center gap-2"
            >
              <Zap className="h-5 w-5 fill-current" />
              Profiter de l'offre Founder
            </Link>
            <a
              href="#demo"
              className="w-full sm:w-auto px-8 py-4 rounded-xl border border-slate-700 bg-slate-800/50 text-slate-300 font-semibold text-lg hover:bg-slate-800 hover:text-white transition-all flex items-center justify-center gap-2 backdrop-blur-sm"
            >
              <Play className="h-5 w-5" />
              Voir la démo
            </a>
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
            <div className="flex items-center gap-2 font-bold text-xl sm:text-2xl text-white"><span className="text-[#F22F46]">Twilio</span></div>
            <div className="flex items-center gap-2 font-bold text-xl sm:text-2xl text-white"><span className="text-[#635BFF]">Stripe</span></div>
            <div className="flex items-center gap-2 font-bold text-xl sm:text-2xl text-white"><span className="text-[#4285F4]">Google</span> Calendar</div>
            <div className="flex items-center gap-2 font-bold text-xl sm:text-2xl text-white">iClosed</div>
            <div className="flex items-center gap-2 font-bold text-xl sm:text-2xl text-white">Cal.com</div>
            <div className="flex items-center gap-2 font-bold text-xl sm:text-2xl text-white">Calendly</div>
            <div className="flex items-center gap-2 font-bold text-xl sm:text-2xl text-white">Hubspot</div>
            <div className="flex items-center gap-2 font-bold text-xl sm:text-2xl text-white">Pipedrive</div>
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
                <h3 className="text-2xl font-bold text-white mb-3">Agenda & Booking (Cal.com & Calendly)</h3>
                <p className="text-slate-400 mb-6 max-w-md leading-relaxed">
                  Connectez vos outils existants. Vos rendez-vous Cal.com et Calendly remontent automatiquement dans votre Pipeline et votre Agenda CloseOS.
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
              <h3 className="text-xl font-bold text-white mb-3">Facturation Auto</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Générez vos factures de commissions en un clic. Suivez les paiements, exportez en PDF.
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
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ROADMAP TIMELINE */}
      <section className="py-24 bg-[#0B1121] border-t border-white/5 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-600/8 blur-[150px] rounded-full pointer-events-none" />
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center mb-16">
            <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-bold text-indigo-400 uppercase tracking-widest">
              Roadmap 2025
            </span>
            <h2 className="text-3xl sm:text-5xl font-bold text-white mt-6">Le Futur du Closing</h2>
            <p className="text-slate-400 mt-4 max-w-2xl mx-auto">Notre vision pour faire de CloseOS le système d'exploitation incontournable des closers, agences et infopreneurs.</p>
          </div>

          {/* Timeline */}
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-blue-500/50 via-indigo-500/50 via-purple-500/50 to-emerald-500/50 -translate-x-1/2 hidden md:block" />
            <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-blue-500/50 via-indigo-500/50 via-purple-500/50 to-emerald-500/50 md:hidden" />

            <div className="space-y-0">

              {/* ===== Q1 ===== */}
              <div className="relative flex items-start md:justify-center gap-6 md:gap-0">
                {/* Quarter badge - center on desktop */}
                <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 z-20">
                  <div className="px-4 py-2 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-500/30 border border-blue-400/30">
                    Q1 2025
                  </div>
                </div>
                {/* Mobile badge */}
                <div className="md:hidden flex-shrink-0 z-20 relative">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center text-white text-[10px] font-black shadow-lg shadow-blue-500/30 border border-blue-400/30">Q1</div>
                </div>
                <div className="md:w-1/2 md:pr-12 md:text-right pt-1 md:pt-12" />
                <div className="md:w-1/2 md:pl-12 pt-1 md:pt-12">
                  <div className="group p-5 rounded-2xl bg-slate-900/80 border border-blue-500/20 hover:border-blue-500/40 transition-all duration-300 backdrop-blur-sm hover:shadow-lg hover:shadow-blue-500/5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-blue-500/20 group-hover:bg-blue-500/30 transition-colors"><Zap className="h-5 w-5 text-blue-400" /></div>
                      <div>
                        <h3 className="font-bold text-white text-sm">Lancement de CloseOS</h3>
                        <span className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider">Janvier</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">Sortie officielle de la plateforme. CRM, Pipeline, Agenda, Booking, VoIP, Facturation et KPIs — tout réuni dans un seul outil.</p>
                    <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
                    </div>
                  </div>
                </div>
              </div>

              {/* Dot on line */}
              <div className="hidden md:block absolute left-1/2 -translate-x-1/2" style={{ top: '8%' }}>
                <div className="w-3 h-3 rounded-full bg-blue-500 ring-4 ring-blue-500/20" />
              </div>

              {/* ===== Q2 ===== */}
              <div className="relative pt-8">
                {/* Quarter badge */}
                <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 z-20">
                  <div className="px-4 py-2 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-500/30 border border-indigo-400/30">
                    Q2 2025
                  </div>
                </div>
                <div className="md:hidden flex items-start gap-6 mb-4">
                  <div className="flex-shrink-0 z-20 relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white text-[10px] font-black shadow-lg shadow-indigo-500/30 border border-indigo-400/30">Q2</div>
                  </div>
                  <div className="text-xs text-indigo-400 font-bold uppercase pt-3 tracking-widest">Avril — Juin</div>
                </div>

                <div className="space-y-4 pt-4 md:pt-12">
                  {/* Début Q2: Interface Infopreneur */}
                  <div className="relative flex items-start md:justify-center gap-6 md:gap-0">
                    <div className="md:hidden w-12 flex-shrink-0" />
                    <div className="md:w-1/2 md:pr-12 md:text-right">
                      <div className="group p-5 rounded-2xl bg-slate-900/80 border border-indigo-500/20 hover:border-indigo-500/40 transition-all duration-300 backdrop-blur-sm hover:shadow-lg hover:shadow-indigo-500/5">
                        <div className="flex items-center gap-3 mb-2 md:flex-row-reverse">
                          <div className="p-2 rounded-lg bg-indigo-500/20 group-hover:bg-indigo-500/30 transition-colors"><Building2 className="h-5 w-5 text-indigo-400" /></div>
                          <div className="md:text-right">
                            <h3 className="font-bold text-white text-sm">Interface Infopreneur / Entrepreneur</h3>
                            <span className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider">Début Q2</span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">Dashboard multi-closers, attribution automatique des leads, suivi de performance par équipe et messagerie interne pour un pilotage à 360°.</p>
                      </div>
                    </div>
                    <div className="hidden md:block md:w-1/2 md:pl-12" />
                  </div>

                  {/* Milieu Q2: Interface Agence */}
                  <div className="relative flex items-start md:justify-center gap-6 md:gap-0">
                    <div className="md:hidden w-12 flex-shrink-0" />
                    <div className="hidden md:block md:w-1/2 md:pr-12" />
                    <div className="md:w-1/2 md:pl-12">
                      <div className="group p-5 rounded-2xl bg-slate-900/80 border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300 backdrop-blur-sm hover:shadow-lg hover:shadow-purple-500/5">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 rounded-lg bg-purple-500/20 group-hover:bg-purple-500/30 transition-colors"><Users className="h-5 w-5 text-purple-400" /></div>
                          <div>
                            <h3 className="font-bold text-white text-sm">Interface Agence</h3>
                            <span className="text-[10px] text-purple-400 font-semibold uppercase tracking-wider">Milieu Q2</span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">Dédiée aux agences de closing. Pilotez plusieurs équipes, gérez l'attribution des leads et analysez la rentabilité de chaque closer.</p>
                      </div>
                    </div>
                  </div>

                  {/* Fin Q2: Analyse IA */}
                  <div className="relative flex items-start md:justify-center gap-6 md:gap-0">
                    <div className="md:hidden w-12 flex-shrink-0" />
                    <div className="md:w-1/2 md:pr-12 md:text-right">
                      <div className="group p-5 rounded-2xl bg-slate-900/80 border border-violet-500/20 hover:border-violet-500/40 transition-all duration-300 backdrop-blur-sm hover:shadow-lg hover:shadow-violet-500/5">
                        <div className="flex items-center gap-3 mb-2 md:flex-row-reverse">
                          <div className="p-2 rounded-lg bg-violet-500/20 group-hover:bg-violet-500/30 transition-colors"><BrainCircuit className="h-5 w-5 text-violet-400" /></div>
                          <div className="md:text-right">
                            <h3 className="font-bold text-white text-sm">Analyse IA</h3>
                            <span className="text-[10px] text-violet-400 font-semibold uppercase tracking-wider">Fin Q2</span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">Feedback objectif sur vos appels. Identifiez les objections non traitées et les moments clés pour améliorer votre taux de conversion.</p>
                      </div>
                    </div>
                    <div className="hidden md:block md:w-1/2 md:pl-12" />
                  </div>
                </div>
              </div>

              {/* ===== Q3 ===== */}
              <div className="relative pt-8">
                {/* Quarter badge */}
                <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 z-20">
                  <div className="px-4 py-2 rounded-full bg-gradient-to-r from-amber-600 to-orange-500 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-amber-500/30 border border-amber-400/30">
                    Q3 2025
                  </div>
                </div>
                <div className="md:hidden flex items-start gap-6 mb-4">
                  <div className="flex-shrink-0 z-20 relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-600 to-orange-500 flex items-center justify-center text-white text-[10px] font-black shadow-lg shadow-amber-500/30 border border-amber-400/30">Q3</div>
                  </div>
                  <div className="text-xs text-amber-400 font-bold uppercase pt-3 tracking-widest">Juillet — Septembre</div>
                </div>

                <div className="space-y-4 pt-4 md:pt-12">
                  {/* Milieu Q3: Application Mobile */}
                  <div className="relative flex items-start md:justify-center gap-6 md:gap-0">
                    <div className="md:hidden w-12 flex-shrink-0" />
                    <div className="hidden md:block md:w-1/2 md:pr-12" />
                    <div className="md:w-1/2 md:pl-12">
                      <div className="group p-5 rounded-2xl bg-slate-900/80 border border-amber-500/20 hover:border-amber-500/40 transition-all duration-300 backdrop-blur-sm hover:shadow-lg hover:shadow-amber-500/5">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 rounded-lg bg-amber-500/20 group-hover:bg-amber-500/30 transition-colors"><Smartphone className="h-5 w-5 text-amber-400" /></div>
                          <div>
                            <h3 className="font-bold text-white text-sm">Application Mobile Native</h3>
                            <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">Milieu Q3</span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">Gérez votre pipeline, recevez vos notifs et passez vos appels depuis votre poche. iOS {'&'} Android.</p>
                      </div>
                    </div>
                  </div>

                  {/* Fin Q3: CRM complet */}
                  <div className="relative flex items-start md:justify-center gap-6 md:gap-0">
                    <div className="md:hidden w-12 flex-shrink-0" />
                    <div className="md:w-1/2 md:pr-12 md:text-right">
                      <div className="group p-5 rounded-2xl bg-slate-900/80 border border-orange-500/20 hover:border-orange-500/40 transition-all duration-300 backdrop-blur-sm hover:shadow-lg hover:shadow-orange-500/5">
                        <div className="flex items-center gap-3 mb-2 md:flex-row-reverse">
                          <div className="p-2 rounded-lg bg-orange-500/20 group-hover:bg-orange-500/30 transition-colors"><Database className="h-5 w-5 text-orange-400" /></div>
                          <div className="md:text-right">
                            <h3 className="font-bold text-white text-sm">CRM Complet & Acquisition de Leads</h3>
                            <span className="text-[10px] text-orange-400 font-semibold uppercase tracking-wider">Fin Q3</span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">Fini les CRM de base. CloseOS devient un vrai CRM complet avec acquisition de leads, nurturing, scoring et suivi du cycle de vente de A à Z.</p>
                      </div>
                    </div>
                    <div className="hidden md:block md:w-1/2 md:pl-12" />
                  </div>
                </div>
              </div>

              {/* ===== Q4 ===== */}
              <div className="relative pt-8 pb-4">
                {/* Quarter badge */}
                <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 z-20">
                  <div className="px-4 py-2 rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-500/30 border border-emerald-400/30">
                    Q4 2025
                  </div>
                </div>
                <div className="md:hidden flex items-start gap-6 mb-4">
                  <div className="flex-shrink-0 z-20 relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center text-white text-[10px] font-black shadow-lg shadow-emerald-500/30 border border-emerald-400/30">Q4</div>
                  </div>
                  <div className="text-xs text-emerald-400 font-bold uppercase pt-3 tracking-widest">Octobre — Décembre</div>
                </div>

                <div className="space-y-4 pt-4 md:pt-12">
                  {/* Q4: Messagerie Interne */}
                  <div className="relative flex items-start md:justify-center gap-6 md:gap-0">
                    <div className="md:hidden w-12 flex-shrink-0" />
                    <div className="hidden md:block md:w-1/2 md:pr-12" />
                    <div className="md:w-1/2 md:pl-12">
                      <div className="group p-5 rounded-2xl bg-slate-900/80 border border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-300 backdrop-blur-sm hover:shadow-lg hover:shadow-emerald-500/5">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 rounded-lg bg-emerald-500/20 group-hover:bg-emerald-500/30 transition-colors"><MessageSquare className="h-5 w-5 text-emerald-400" /></div>
                          <div>
                            <h3 className="font-bold text-white text-sm">Messagerie Interne & Chat Équipe</h3>
                            <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Q4</span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">Communication en temps réel entre closers et managers, directement intégrée au pipeline. Fini les conversations éparpillées sur WhatsApp et Slack.</p>
                      </div>
                    </div>
                  </div>
                </div>
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
                  <p className="text-red-400 text-xs font-bold uppercase tracking-widest mb-1">PERTE ESTIMÉE</p>
                  {/* MODIFICATION 2 : 35H + SOUS-TITRE */}
                  <div className="text-4xl font-black text-white">
                    35h<span className="text-lg text-slate-500 font-medium">/semaine</span>
                  </div>
                  <p className="text-slate-400 text-sm mt-3 font-semibold">
                    Presque 2 mois par an perdus en administration.
                  </p>
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

                <div className="mt-8 pt-8 border-t border-blue-500/20 text-center relative overflow-hidden">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-blue-500/50 blur-[2px]"></div>
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
      </section>

      {/* PRICING SECTION */}
      <section id="pricing" className="py-32 relative bg-slate-950">
        <div className="mx-auto max-w-7xl px-6 relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white sm:text-5xl">Rejoignez l'Élite.</h2>
            <p className="text-slate-400 mt-4 text-lg">Choisissez l'outil qui va doubler votre taux de closing.</p>
          </div>

          {/* SELECTEUR D'ONGLETS & SWITCH */}
          <div className="flex flex-col items-center mb-12">
            <div className="inline-flex p-1 bg-slate-900 rounded-xl border border-slate-800 mb-6">
              <button
                onClick={() => setPricingTab('closer')}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${pricingTab === 'closer'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
              >
                Closer Indépendant
              </button>
              <button
                onClick={() => setPricingTab('agency')}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${pricingTab === 'agency'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
              >
                Agence
              </button>
              <button
                onClick={() => setPricingTab('enterprise')}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${pricingTab === 'enterprise'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
              >
                Entreprise / Infopreneur
              </button>
            </div>

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
          </div>

          {/* CONTENU DES ONGLETS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start max-w-5xl mx-auto">

            {pricingTab === 'closer' && (
              <>
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
                      <span>Pipeline de vente illimité</span>
                    </li>
                    <li className="flex gap-3 text-sm text-slate-300">
                      <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0" />
                      <span>Agenda & Booking intégré</span>
                    </li>
                    <li className="flex gap-3 text-sm text-slate-300">
                      <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0" />
                      <span>Facturation automatisée</span>
                    </li>
                    <li className="flex gap-3 text-sm text-slate-300">
                      <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0" />
                      <span>Support standard par email</span>
                    </li>
                  </ul>
                  <Link
                    to={`/checkout-starter?billing=${billingCycle}`}
                    className="w-full py-4 rounded-xl border border-slate-700 font-bold text-center text-slate-300 hover:bg-slate-800 hover:text-white transition-colors block"
                  >
                    Démarrer en Starter
                  </Link>
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
                      {/* MODIFICATION 3 : PRIX BARRÉ RESTE 69€ */}
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
                      <span>Toutes les fonctionnalités Starter</span>
                    </li>
                    <li className="flex gap-3 text-sm text-white font-medium">
                      <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                      <span>Synchronisation CRM (HubSpot, etc.)</span>
                    </li>
                    <li className="flex gap-3 text-sm text-white font-medium">
                      <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                      <span>Accès prioritaire aux futures IA</span>
                    </li>
                    <li className="flex gap-3 text-sm text-white font-medium">
                      <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                      <span>Badge "Membre Fondateur"</span>
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
                </div>
              </>
            )}

            {pricingTab === 'agency' && (
              <div className="col-span-1 md:col-span-2 rounded-3xl border border-indigo-500/30 bg-indigo-950/10 p-10 flex flex-col items-center text-center animate-in fade-in zoom-in duration-300 relative group overflow-hidden">
                <div className="absolute inset-0 bg-red-600/80 backdrop-blur-[2px] z-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                  <span className="text-white text-2xl font-bold uppercase tracking-widest border-2 border-white/50 px-6 py-3 rounded-xl bg-red-950/50 -rotate-2">
                    Prochainement
                  </span>
                </div>

                <div className="h-16 w-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-6">
                  <Users className="h-8 w-8 text-indigo-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Offre Agence & Réseaux</h3>
                <p className="text-slate-300 max-w-lg mb-8">
                  Dédiée aux agences de closing. Pilotez plusieurs équipes, gérez l'attribution des leads et analysez la rentabilité de chaque closer en temps réel.
                </p>
                {/* MODIFICATION 4 : GAP AUGMENTÉ */}
                <div className="grid md:grid-cols-2 gap-10 w-full max-w-2xl mb-10 text-left">
                  <div className="flex gap-3">
                    <CheckCircle2 className="h-5 w-5 text-indigo-400 shrink-0" />
                    <span className="text-sm text-slate-300">Dashboard Superviseur</span>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle2 className="h-5 w-5 text-indigo-400 shrink-0" />
                    <span className="text-sm text-slate-300">Attribution auto des leads</span>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle2 className="h-5 w-5 text-indigo-400 shrink-0" />
                    <span className="text-sm text-slate-300">Facturation centralisée</span>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle2 className="h-5 w-5 text-indigo-400 shrink-0" />
                    <span className="text-sm text-slate-300">Onboarding prioritaire</span>
                  </div>
                </div>
                <a href="mailto:support@closeos.fr?subject=Demande%20Agence" className="px-8 py-4 rounded-xl bg-white text-indigo-950 font-bold hover:bg-indigo-50 transition-colors">
                  Contacter l'équipe Sales
                </a>
              </div>
            )}

            {pricingTab === 'enterprise' && (
              <div className="col-span-1 md:col-span-2 rounded-3xl border border-emerald-500/30 bg-emerald-950/10 p-10 flex flex-col items-center text-center animate-in fade-in zoom-in duration-300 relative group overflow-hidden">
                <div className="absolute inset-0 bg-red-600/80 backdrop-blur-[2px] z-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                  <span className="text-white text-2xl font-bold uppercase tracking-widest border-2 border-white/50 px-6 py-3 rounded-xl bg-red-950/50 -rotate-2">
                    Prochainement
                  </span>
                </div>

                <div className="h-16 w-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-6">
                  <Building2 className="h-8 w-8 text-emerald-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Pour Infopreneurs & Entreprises</h3>
                <p className="text-slate-300 max-w-lg mb-8">
                  Pour les business qui scalent. Management d'équipe centralisé, attribution auto des leads et messagerie interne pour un pilotage à 360°.
                </p>
                {/* MODIFICATION 4 : GAP AUGMENTÉ */}
                <div className="grid md:grid-cols-2 gap-10 w-full max-w-2xl mb-10 text-left">
                  <div className="flex gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                    <span className="text-sm text-slate-300">Intégration CRM sur-mesure</span>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                    <span className="text-sm text-slate-300">API & Webhooks dédiés</span>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                    <span className="text-sm text-slate-300">SLA & Support 24/7</span>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                    <span className="text-sm text-slate-300">Audit de process offert</span>
                  </div>
                </div>
                <a href="mailto:support@closeos.fr?subject=Demande%20Entreprise" className="px-8 py-4 rounded-xl bg-white text-emerald-950 font-bold hover:bg-emerald-50 transition-colors">
                  Parler à un expert
                </a>
              </div>
            )}

          </div>

          {/* MODIFICATION 5 : ENCART OPTION VOIP CACHÉ SI PAS CLOSER + PRIX DYNAMIQUE */}
          {pricingTab === 'closer' && (
            <div className="mt-8 flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
              <div className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-blue-900/20 border border-blue-500/30 shadow-lg shadow-blue-500/5">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <PlusCircle className="h-5 w-5 text-blue-400" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-white">Option VoIP & Enregistrements</p>
                  <p className="text-xs text-blue-300">
                    Ajoutez la téléphonie à votre plan pour <span className="text-white font-bold">+{billingCycle === 'yearly' ? '4' : '5'}€/mois</span>
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>
      </section>

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
            <Link to="/mentions-legales" className="hover:text-white transition-colors">Mentions Légales</Link>
            <span className="hidden sm:inline">•</span>
            <Link to="/cgu" className="hover:text-white transition-colors">CGV & CGU</Link>
            <span className="hidden sm:inline">•</span>
            <Link to="/confidentialite" className="hover:text-white transition-colors">Confidentialité</Link>
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
    </div>
  )
}