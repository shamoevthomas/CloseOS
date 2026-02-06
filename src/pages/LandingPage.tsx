import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  Zap,
  BarChart3,
  Target,
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
  Bot,
  Star,
  ShieldCheck
} from 'lucide-react'

export function LandingPage() {
  
  // 👇 COLLE TES LIENS STRIPE ICI 👇
  const STRIPE_LINK_FOUNDER = "https://buy.stripe.com/TON_LIEN_FOUNDER_19EUROS"; 
  const STRIPE_LINK_STARTER = "https://buy.stripe.com/TON_LIEN_STARTER_30EUROS";

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans selection:bg-blue-500/30 overflow-x-hidden">
      
      {/* --- BANDEAU OFFRE PRÉLANCEMENT --- */}
      <div className="fixed top-0 z-[60] w-full bg-blue-600 py-2.5 text-center text-xs sm:text-sm font-bold text-white shadow-lg animate-in slide-in-from-top duration-500">
        🚀 OFFRE DE PRÉLANCEMENT : Rejoignez les Founders pour 19€/mois à VIE (au lieu de 69€). 
        <span className="hidden sm:inline"> L'essai gratuit débutera au lancement officiel.</span>
      </div>

      {/* --- NAVBAR --- */}
      <nav className="fixed top-[40px] z-50 w-full border-b border-white/5 bg-[#020617]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-600 to-purple-600 shadow-lg shadow-blue-500/20">
              <Target className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">CloseOS</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Fonctionnalités</a>
            <a href="#comparison" className="hover:text-white transition-colors">Comparatif</a>
            <a href="#pricing" className="text-white font-semibold transition-colors">Tarifs</a>
          </div>
          <div className="flex items-center gap-4">
            <Link 
              to="/login" 
              className="group flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              <LogIn className="h-4 w-4 text-slate-500 group-hover:text-white transition-colors" />
              <span className="hidden sm:inline">Se connecter</span>
            </Link>
            <a 
              href="#pricing" 
              className="hidden sm:flex group items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-bold text-slate-950 transition-all hover:bg-blue-50 hover:scale-105 active:scale-95"
            >
              Devenir Founder
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </div>
      </nav>

      {/* --- HERO SECTION --- */}
      <section className="relative pt-40 pb-20 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-blue-600/20 opacity-30 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />
        <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-purple-600/10 opacity-20 blur-[100px] rounded-full pointer-events-none mix-blend-screen" />
        
        <div className="relative mx-auto max-w-7xl px-6 text-center z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 hover:bg-blue-500/20 transition-colors cursor-default">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            Le Système d'Exploitation des Closers
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
            CRM, Agenda, Booking, VoIP, Facturation, Visio, KPIs...<br/>
            <strong className="text-white">CloseOS</strong> réunit TOUT ce dont vous avez besoin pour closer dans une seule interface.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
            <a 
              href="#pricing" 
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-blue-600 text-white font-bold text-lg hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-1 flex items-center justify-center gap-2"
            >
              <Zap className="h-5 w-5 fill-current" />
              Profiter de l'offre Founder
            </a>
            <Link to="/login" className="w-full sm:w-auto px-8 py-4 rounded-xl border border-slate-700 bg-slate-800/50 text-slate-300 font-semibold text-lg hover:bg-slate-800 hover:text-white transition-all flex items-center justify-center gap-2 backdrop-blur-sm">
              <Play className="h-5 w-5" />
              Voir la démo
            </Link>
          </div>

          {/* DASHBOARD PREVIEW */}
          <div className="mt-20 relative mx-auto max-w-6xl animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-500 group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 rounded-2xl opacity-20 blur-lg group-hover:opacity-40 transition-opacity duration-1000"></div>
            <div className="relative rounded-xl border border-slate-800 bg-[#0B1121] shadow-2xl overflow-hidden ring-1 ring-white/10">
               <img 
                 src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2670&auto=format&fit=crop" 
                 alt="Dashboard CloseOS" 
                 className="w-full h-auto opacity-90 transition-opacity hover:opacity-100" 
               />
               <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent opacity-80"></div>
            </div>
          </div>
        </div>
      </section>

      {/* --- INTEGRATIONS BANNER --- */}
      <section id="integrations" className="py-12 border-y border-white/5 bg-slate-950/50">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <p className="text-xs font-bold text-slate-500 mb-8 uppercase tracking-widest">
            Synchronisation native avec vos outils préférés
          </p>
          <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-8 opacity-60 grayscale hover:grayscale-0 transition-all duration-700">
             <div className="flex items-center gap-2 font-bold text-xl sm:text-2xl text-white"><span className="text-[#25D366]">WhatsApp</span></div>
             <div className="flex items-center gap-2 font-bold text-xl sm:text-2xl text-white"><span className="text-[#F22F46]">Twilio</span></div>
             <div className="flex items-center gap-2 font-bold text-xl sm:text-2xl text-white"><span className="text-[#4285F4]">Google</span> Calendar</div>
             <div className="flex items-center gap-2 font-bold text-xl sm:text-2xl text-white">iClosed</div>
             <div className="flex items-center gap-2 font-bold text-xl sm:text-2xl text-white">Cal.com</div>
             <div className="flex items-center gap-2 font-bold text-xl sm:text-2xl text-white">Calendly</div>
             <div className="flex items-center gap-2 font-bold text-xl sm:text-2xl text-white">Hubspot</div>
             <div className="flex items-center gap-2 font-bold text-xl sm:text-2xl text-white">Pipedrive</div>
          </div>
        </div>
      </section>

      {/* --- FEATURES GRID --- */}
      <section id="features" className="py-32 relative">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-20 text-center max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-white sm:text-5xl mb-6">Tout est là.<br/>Au même endroit.</h2>
            <p className="text-lg text-slate-400">
              Arrêtez de perdre du temps à switcher entre les onglets. CloseOS centralise votre flux de travail pour que vous puissiez vous concentrer sur l'essentiel : <span className="text-emerald-400 font-semibold">Le Closing.</span>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* 1. COCKPIT & KPI */}
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
                   <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="h-4 w-4 text-emerald-500"/> Cash encaissé</li>
                   <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="h-4 w-4 text-emerald-500"/> Taux de closing</li>
                   <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="h-4 w-4 text-emerald-500"/> Commissions prévisionnelles</li>
                   <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="h-4 w-4 text-emerald-500"/> Deals en cours</li>
                </ul>
              </div>
            </div>

            {/* 2. WHATSAPP & VOIP (TWILIO) */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-8 hover:border-[#25D366]/30 transition-all duration-500 group hover:bg-slate-900/80 relative overflow-hidden">
               <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <MessageSquare className="w-32 h-32 text-[#25D366]" />
               </div>
              <div className="h-12 w-12 rounded-lg bg-[#25D366]/20 flex items-center justify-center mb-6 ring-1 ring-[#25D366]/30">
                <Phone className="h-6 w-6 text-[#25D366]" />
              </div>
              
              {/* 👇 TEXTE MODIFIÉ POUR ÊTRE HONNÊTE 👇 */}
              <h3 className="text-xl font-bold text-white mb-3">Téléphonie VoIP & Click-to-WhatsApp</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                Appelez vos prospects en un clic via Twilio (appels enregistrés). 
                Lancez vos conversations WhatsApp instantanément sans enregistrer le numéro.
                <span className="block mt-2 text-[#25D366] text-xs font-bold uppercase tracking-wide">
                    🚀 Zéro friction au quotidien
                </span>
              </p>
            </div>

            {/* 3. PIPELINE & OFFRES */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-8 hover:border-orange-500/30 transition-all duration-500 group hover:bg-slate-900/80">
              <div className="h-12 w-12 rounded-lg bg-orange-500/20 flex items-center justify-center mb-6 ring-1 ring-orange-500/30">
                <TrendingUp className="h-6 w-6 text-orange-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Pipeline & Offres</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                Vue Kanban fluide. Configurez vos offres (prix, commissions, formules) et laissez l'outil calculer vos gains à chaque deal déplacé.
              </p>
            </div>

            {/* 4. AGENDA & BOOKING */}
            <div className="md:col-span-2 rounded-3xl border border-slate-800 bg-slate-900/50 p-8 hover:border-purple-500/30 transition-all duration-500 group overflow-hidden relative hover:bg-slate-900/80">
               <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-20 transition-opacity duration-500 transform group-hover:rotate-12 group-hover:scale-110">
                <CalendarCheck className="w-64 h-64 text-purple-500" />
              </div>
              <div className="relative z-10">
                <div className="h-12 w-12 rounded-lg bg-purple-500/20 flex items-center justify-center mb-6 ring-1 ring-purple-500/30">
                  <CalendarCheck className="h-6 w-6 text-purple-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Agenda & Booking (Bye bye Calendly)</h3>
                <p className="text-slate-400 mb-6 max-w-md leading-relaxed">
                  Créez vos liens de réservation, synchronisez tout avec Google Calendar. Quand un prospect réserve, il arrive direct dans votre Pipeline et votre Agenda.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300">Sync Google Calendar</span>
                  <span className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300">Liens de booking personnalisés</span>
                  <span className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300">Rappels automatiques</span>
                </div>
              </div>
            </div>

             {/* 5. FACTURATION */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-8 hover:border-emerald-500/30 transition-all duration-500 group hover:bg-slate-900/80">
              <div className="h-12 w-12 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-6 ring-1 ring-emerald-500/30">
                <FileText className="h-6 w-6 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Facturation Auto</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Générez vos factures de commissions en un clic. Suivez les paiements, exportez en PDF. Comptable-ready.
              </p>
            </div>
             
             {/* 6. SYNC CRM & AUTOMATISATIONS */}
             <div className="md:col-span-2 rounded-3xl border border-slate-800 bg-slate-900/50 p-8 hover:border-[#E11D48]/30 transition-all duration-500 group overflow-hidden relative hover:bg-slate-900/80">
               <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-20 transition-opacity duration-500">
                <Zap className="w-64 h-64 text-[#E11D48]" />
              </div>
               <div className="relative z-10">
                 <div className="h-12 w-12 rounded-lg bg-[#E11D48]/20 flex items-center justify-center mb-6 ring-1 ring-[#E11D48]/30">
                   <Zap className="h-6 w-6 text-[#E11D48]" />
                 </div>
                 <h3 className="text-2xl font-bold text-white mb-3">Sync CRM (HubSpot, Pipedrive) & iClosed</h3>
                 <p className="text-slate-400 mb-6 max-w-lg leading-relaxed">
                   Synchronisation native avec iClosed, HubSpot et Pipedrive. Vos leads et vos deals circulent en temps réel. Oubliez la double saisie manuelle et automatisez 100% de votre suivi.
                 </p>
               </div>
             </div>
          </div>
        </div>
      </section>

      {/* --- COMPARISON SECTION --- */}
      <section id="comparison" className="py-24 bg-slate-900/30 border-y border-white/5 relative">
        <div className="mx-auto max-w-6xl px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white">L'ancienne méthode vs CloseOS</h2>
            <p className="text-slate-400 mt-4">La différence entre un Amateur et un Pro se joue sur l'organisation (et le coût).</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-stretch">
            {/* The Old Way (Red) */}
            <div className="rounded-2xl border border-red-900/30 bg-red-950/10 p-8 opacity-90 hover:opacity-100 transition-opacity flex flex-col">
              <h3 className="text-xl font-bold text-red-400 mb-6 flex items-center gap-2">
                <XCircle className="h-6 w-6" /> L'Enfer des Abonnements
              </h3>
              <div className="space-y-3 text-sm text-slate-300 flex-1">
                 <div className="flex items-center justify-between p-4 bg-red-900/20 rounded-xl border border-red-900/30">
                    <span className="font-medium">CRM Séparé</span>
                    <span className="text-red-300 font-bold">Pipedrive ($$)</span>
                 </div>
                 <div className="flex items-center justify-between p-4 bg-red-900/20 rounded-xl border border-red-900/30 relative overflow-hidden">
                    <div className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none"></div>
                    <span className="font-medium flex items-center gap-2"><Phone className="h-4 w-4"/> Téléphonie VoIP</span>
                    <span className="text-red-300 font-bold">Aircall (~40€/mois)</span>
                 </div>
                 <div className="flex items-center justify-between p-4 bg-red-900/20 rounded-xl border border-red-900/30">
                    <span className="font-medium">Booking</span>
                    <span className="text-red-300 font-bold">Calendly ($12/mois)</span>
                 </div>
                 <div className="flex items-center justify-between p-4 bg-red-900/20 rounded-xl border border-red-900/30">
                    <span className="font-medium flex items-center gap-2"><Bot className="h-4 w-4"/> Automatisation</span>
                    <span className="text-red-300 font-bold">Zapier ($25/mois)</span>
                 </div>
                 <div className="flex items-center justify-between p-4 bg-red-900/20 rounded-xl border border-red-900/30">
                    <span className="font-medium">Visio</span>
                    <span className="text-red-300 font-bold">Zoom ($15/mois)</span>
                 </div>
              </div>
              <p className="mt-8 text-center text-red-400 font-bold text-base bg-red-950/30 p-4 rounded-xl border border-red-900/50">
                Total : {'>'}120€/mois par closer.<br/>Et un chaos administratif.
              </p>
            </div>

            {/* The CloseOS Way (Blue - Stacked) */}
            <div className="rounded-2xl border border-blue-500/30 bg-blue-950/20 p-8 shadow-2xl shadow-blue-900/20 ring-1 ring-blue-500/20 relative overflow-hidden flex flex-col">
               <div className="absolute inset-0 bg-blue-500/5 animate-pulse pointer-events-none"></div>
              <h3 className="text-xl font-bold text-blue-400 mb-6 flex items-center gap-2 relative z-10">
                <CheckCircle2 className="h-6 w-6" /> CloseOS : La Machine de Guerre
              </h3>
              
              <div className="flex-1 relative z-10 flex flex-col gap-3">
                <div className="p-5 bg-blue-600/20 border border-blue-500/40 rounded-xl flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-blue-500/30 flex items-center justify-center">
                        <Target className="h-6 w-6 text-blue-300" />
                    </div>
                    <div>
                        <h4 className="font-bold text-white text-lg">CRM & Pipeline Centralisé</h4>
                        <p className="text-blue-200 text-xs">Plus besoin de Salesforce ou Pipedrive.</p>
                    </div>
                </div>
                
                <div className="p-5 bg-blue-600/30 border border-blue-500/50 rounded-xl flex items-center gap-4 relative overflow-hidden shadow-lg shadow-blue-500/10">
                    <div className="absolute inset-0 bg-blue-400/10 animate-pulse pointer-events-none"></div>
                    <div className="h-10 w-10 rounded-lg bg-blue-500/40 flex items-center justify-center">
                        <Phone className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h4 className="font-bold text-white text-lg">VoIP Natif & WhatsApp</h4>
                        <p className="text-blue-100 text-xs font-semibold">Appels illimités inclus*. Bye bye Aircall.</p>
                    </div>
                </div>

                <div className="p-5 bg-blue-600/20 border border-blue-500/40 rounded-xl flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-blue-500/30 flex items-center justify-center">
                        <Zap className="h-6 w-6 text-blue-300" />
                    </div>
                    <div>
                        <h4 className="font-bold text-white text-lg">Automatisations & Booking</h4>
                        <p className="text-blue-200 text-xs">Système intégré. Oubliez Zapier et Calendly.</p>
                    </div>
                </div>
              </div>

              <p className="mt-8 text-center text-blue-300 font-bold text-xl bg-blue-900/30 p-4 rounded-xl border border-blue-500/50 relative z-10">
                = 1 seul abonnement.<br/>Zéro friction. Focus total.
              </p>
              <p className="text-center text-blue-400/60 text-xs mt-2">*Selon le forfait choisi.</p>
            </div>
          </div>
        </div>
      </section>

      {/* --- PRICING SECTION (NEW) --- */}
      <section id="pricing" className="py-32 relative bg-slate-950">
        <div className="mx-auto max-w-7xl px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white sm:text-5xl">Rejoignez l'Élite.</h2>
            <p className="text-slate-400 mt-4 text-lg">Choisissez l'outil qui va doubler votre taux de closing.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            
            {/* PLAN STARTER */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-8 flex flex-col h-full opacity-80 hover:opacity-100 transition-opacity">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-white">STARTER</h3>
                <p className="mt-2 text-slate-400 text-sm">Pour les closers qui débutent ou font moins de 5k€/mois.</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">30€</span>
                  <span className="text-slate-500">/mois</span>
                </div>
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
              {/* Le target="_blank" permet d'ouvrir Stripe dans un nouvel onglet pour ne pas perdre le visiteur */}
              <a href={STRIPE_LINK_STARTER} target="_blank" rel="noopener noreferrer" className="w-full py-4 rounded-xl border border-slate-700 font-bold text-center text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
                Démarrer Starter
              </a>
            </div>

            {/* PLAN FOUNDER (HERO) */}
            <div className="rounded-3xl border-2 border-blue-500 bg-blue-950/20 p-8 shadow-2xl shadow-blue-900/40 scale-105 relative z-10 flex flex-col h-full">
              <div className="absolute top-0 right-0 transform translate-x-2 -translate-y-2">
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                  OFFRE PRÉLANCEMENT
                </span>
              </div>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                   <h3 className="text-2xl font-bold text-white">FOUNDER</h3>
                   <Star className="h-5 w-5 text-yellow-400 fill-yellow-400 animate-pulse" />
                </div>
                <p className="mt-2 text-blue-200 text-sm">Accès complet à vie au tarif préférentiel.</p>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-5xl font-extrabold text-white">19€</span>
                  <span className="text-slate-400 line-through text-lg">69€</span>
                  <span className="text-slate-500">/mois à vie</span>
                </div>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex gap-3 text-sm text-white font-medium">
                  <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span>Toutes les fonctionnalités Starter</span>
                </li>
                <li className="flex gap-3 text-sm text-white font-medium">
                  <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span>Appels VoIP & Enregistrements</span>
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
                to="/checkout" 
                className="block w-full py-4 rounded-xl bg-blue-600 text-white font-bold text-center hover:bg-blue-500 transition-all shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40"
              >
                Sécuriser ma place à 19€
              </Link>
              
              <p className="mt-4 text-xs text-center text-slate-500">
                Carte bancaire requise. <strong>Aucun prélèvement avant le lancement officiel</strong> + 7 jours d'essai offerts.
              </p>
            </div>

            {/* PLAN AGENCY (CONTACT) */}
             <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-8 flex flex-col h-full opacity-80 hover:opacity-100 transition-opacity">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-white">AGENCY</h3>
                <p className="mt-2 text-slate-400 text-sm">Pour les équipes de vente et les réseaux.</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">Sur devis</span>
                </div>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex gap-3 text-sm text-slate-300">
                  <CheckCircle2 className="h-5 w-5 text-slate-500 shrink-0" />
                  <span>Tout l'illimité pour vos équipes</span>
                </li>
                <li className="flex gap-3 text-sm text-slate-300">
                  <CheckCircle2 className="h-5 w-5 text-slate-500 shrink-0" />
                  <span>Dashboard Manager & Admin</span>
                </li>
                 <li className="flex gap-3 text-sm text-slate-300">
                  <CheckCircle2 className="h-5 w-5 text-slate-500 shrink-0" />
                  <span>Onboarding personnalisé</span>
                </li>
                 <li className="flex gap-3 text-sm text-slate-300">
                  <CheckCircle2 className="h-5 w-5 text-slate-500 shrink-0" />
                  <span>API dédiée</span>
                </li>
              </ul>
              <a href="mailto:support@closeos.fr" className="w-full py-4 rounded-xl border border-slate-700 font-bold text-center text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
                Contacter l'équipe
              </a>
            </div>

          </div>
        </div>
      </section>

      {/* --- COMING SOON --- */}
      <section className="py-20 bg-[#0B1121]">
         <div className="mx-auto max-w-4xl px-6 text-center">
            <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-bold text-indigo-400 uppercase tracking-widest">
               Prochainement
            </span>
            <h2 className="text-3xl font-bold text-white mt-6 mb-12">Le Futur du Closing</h2>
            <div className="grid md:grid-cols-2 gap-6">
               <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex items-start gap-4 text-left group hover:border-indigo-500/30 transition-all">
                  <div className="p-3 rounded-lg bg-indigo-500/20 group-hover:bg-indigo-500/30 transition-colors"><BrainCircuit className="h-6 w-6 text-indigo-400"/></div>
                  <div>
                     <h3 className="font-bold text-white mb-1">Coach IA en Temps Réel</h3>
                     <p className="text-sm text-slate-400">Analyse vos appels en direct, détecte les objections et vous suggère les meilleures réponses pour closer.</p>
                  </div>
               </div>
               <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex items-start gap-4 text-left group hover:border-indigo-500/30 transition-all">
                  <div className="p-3 rounded-lg bg-indigo-500/20 group-hover:bg-indigo-500/30 transition-colors"><Smartphone className="h-6 w-6 text-indigo-400"/></div>
                  <div>
                     <h3 className="font-bold text-white mb-1">Application Mobile Native</h3>
                     <p className="text-sm text-slate-400">Gérez votre pipeline, recevez vos notifs et passez vos appels depuis votre poche. iOS {'&'} Android.</p>
                  </div>
               </div>
            </div>
         </div>
      </section>

      {/* --- CTA FINAL --- */}
      <section className="relative py-32 overflow-hidden">
        <div className="absolute inset-0 bg-blue-600/10 blur-[100px] rounded-full pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        
        <div className="relative mx-auto max-w-4xl px-6 text-center z-10">
          <h2 className="text-4xl font-bold text-white mb-6">
            Arrêtez de payer pour 10 outils.<br/>Commencez à closer.
          </h2>
          <p className="text-xl text-slate-300 mb-10">
            Rejoignez l'élite des closers qui utilisent le système tout-en-un CloseOS.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a 
              href="#pricing" 
              className="w-full sm:w-auto px-10 py-4 rounded-full bg-white text-slate-950 font-bold text-lg hover:bg-blue-50 hover:scale-105 transition-all flex items-center justify-center gap-2 shadow-xl shadow-white/10"
            >
              Profiter de l'offre Founder (19€/mois)
              <ChevronRight className="h-5 w-5" />
            </a>
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
            <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-600">
               <Target className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-lg font-bold text-white">CloseOS.fr</span>
          </div>
          <div className="text-slate-500 text-sm">
            © 2026 CloseOS.fr. Fait avec ❤️ pour les closers.
          </div>
          <div className="flex gap-6">
            <a href="#" className="text-slate-500 hover:text-white transition-colors">Twitter</a>
            <a href="#" className="text-slate-500 hover:text-white transition-colors">LinkedIn</a>
            <a href="mailto:support@closeos.fr" className="text-slate-500 hover:text-white transition-colors">support@closeos.fr</a>
          </div>
        </div>
      </footer>
    </div>
  )
}