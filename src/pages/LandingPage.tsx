import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  Zap,
  Shield,
  BarChart3,
  PieChart,
  Target,
  Trophy,
  ChevronRight,
  Play,
  XCircle,
  LogIn,
  MessageSquare,
  Video,
  FileText,
  Smartphone,
  BrainCircuit,
  CalendarCheck,
  LayoutDashboard
} from 'lucide-react'

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans selection:bg-blue-500/30 overflow-x-hidden">
      
      {/* --- NAVBAR --- */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/5 bg-[#020617]/80 backdrop-blur-md">
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
            <a href="#integrations" className="hover:text-white transition-colors">Intégrations</a>
          </div>
          <div className="flex items-center gap-4">
            <Link 
              to="/login" 
              className="group flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              <LogIn className="h-4 w-4 text-slate-500 group-hover:text-white transition-colors" />
              Se connecter
            </Link>
            <Link 
              to="/signup" 
              className="hidden sm:flex group items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-bold text-slate-950 transition-all hover:bg-blue-50 hover:scale-105 active:scale-95"
            >
              Essayer Gratuitement
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </nav>

      {/* --- HERO SECTION --- */}
      <section className="relative pt-32 pb-20 overflow-hidden">
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
          </h1>

          <p className="mx-auto max-w-2xl text-lg text-slate-400 mb-10 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200 leading-relaxed">
            CRM, Agenda, Booking, WhatsApp, Facturation, Visio, KPIs...<br/>
            <strong className="text-white">CloseOS</strong> réunit TOUT ce dont vous avez besoin pour closer dans une seule interface.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
            <Link 
              to="/signup" 
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-blue-600 text-white font-bold text-lg hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-1 flex items-center justify-center gap-2"
            >
              <Zap className="h-5 w-5 fill-current" />
              Centraliser mon business
            </Link>
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
          <div className="flex flex-wrap justify-center items-center gap-x-16 gap-y-8 opacity-60 grayscale hover:grayscale-0 transition-all duration-700">
             <div className="flex items-center gap-2 font-bold text-2xl text-white"><span className="text-[#25D366]">WhatsApp</span></div>
             <div className="flex items-center gap-2 font-bold text-2xl text-white"><span className="text-[#4285F4]">Google</span> Calendar</div>
             <div className="flex items-center gap-2 font-bold text-2xl text-white">iClosed</div>
             <div className="flex items-center gap-2 font-bold text-2xl text-white">Cal.com</div>
             <div className="flex items-center gap-2 font-bold text-2xl text-white">Calendly</div>
             <div className="flex items-center gap-2 font-bold text-2xl text-white">Hubspot</div>
             <div className="flex items-center gap-2 font-bold text-2xl text-white">Pipedrive</div>
             <div className="flex items-center gap-2 cursor-pointer group">
                <ArrowRight className="h-6 w-6 text-blue-500 group-hover:translate-x-1 transition-transform" />
             </div>
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

            {/* 2. WHATSAPP */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-8 hover:border-[#25D366]/30 transition-all duration-500 group hover:bg-slate-900/80 relative overflow-hidden">
               <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <MessageSquare className="w-32 h-32 text-[#25D366]" />
               </div>
              <div className="h-12 w-12 rounded-lg bg-[#25D366]/20 flex items-center justify-center mb-6 ring-1 ring-[#25D366]/30">
                <MessageSquare className="h-6 w-6 text-[#25D366]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">WhatsApp Intégré</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                Envoyez et recevez vos messages sans toucher à votre téléphone. Chaque conversation est liée au prospect. Zéro perte d'info.
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
             
             {/* 6. ICLOSED SYNC */}
             <div className="md:col-span-2 rounded-3xl border border-slate-800 bg-slate-900/50 p-8 hover:border-[#E11D48]/30 transition-all duration-500 group overflow-hidden relative hover:bg-slate-900/80">
               <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-20 transition-opacity duration-500">
                <Zap className="w-64 h-64 text-[#E11D48]" />
              </div>
               <div className="relative z-10">
                 <div className="h-12 w-12 rounded-lg bg-[#E11D48]/20 flex items-center justify-center mb-6 ring-1 ring-[#E11D48]/30">
                   <Zap className="h-6 w-6 text-[#E11D48]" />
                 </div>
                 <h3 className="text-2xl font-bold text-white mb-3">iClosed Sync : L'Automatisation Ultime</h3>
                 <p className="text-slate-400 mb-6 max-w-lg leading-relaxed">
                   Quand un lead arrive sur iClosed, il est créé instantanément dans CloseOS. Quand il change de statut, CloseOS se met à jour. Quand vous closez, les notes remontent. <br/><span className="text-white font-medium">Zéro saisie manuelle.</span>
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
            <p className="text-slate-400 mt-4">La différence entre un Amateur et un Pro se joue sur l'organisation.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-start">
            {/* The Old Way */}
            <div className="rounded-2xl border border-red-900/20 bg-red-950/5 p-8 opacity-75 hover:opacity-100 transition-opacity">
              <h3 className="text-xl font-bold text-red-400 mb-6 flex items-center gap-2">
                <XCircle className="h-6 w-6" /> L'Enfer des Outils
              </h3>
              <div className="space-y-4 text-sm text-slate-400">
                 <div className="flex items-center justify-between p-3 bg-red-900/10 rounded-lg">
                    <span>CRM & Suivi</span>
                    <span className="text-red-300">Salesforce / Excel</span>
                 </div>
                 <div className="flex items-center justify-between p-3 bg-red-900/10 rounded-lg">
                    <span>Agenda</span>
                    <span className="text-red-300">Google Calendar</span>
                 </div>
                 <div className="flex items-center justify-between p-3 bg-red-900/10 rounded-lg">
                    <span>Booking</span>
                    <span className="text-red-300">Calendly ($12/mois)</span>
                 </div>
                 <div className="flex items-center justify-between p-3 bg-red-900/10 rounded-lg">
                    <span>Communication</span>
                    <span className="text-red-300">WhatsApp Téléphone</span>
                 </div>
                 <div className="flex items-center justify-between p-3 bg-red-900/10 rounded-lg">
                    <span>Visio</span>
                    <span className="text-red-300">Zoom / Meet</span>
                 </div>
                 <div className="flex items-center justify-between p-3 bg-red-900/10 rounded-lg">
                    <span>Qualification</span>
                    <span className="text-red-300">iClosed</span>
                 </div>
              </div>
              <p className="mt-6 text-center text-red-400 font-medium text-sm">
                = 6+ onglets ouverts, perte de temps, infos perdues.
              </p>
            </div>

            {/* The CloseOS Way */}
            <div className="rounded-2xl border border-blue-500/20 bg-blue-950/10 p-8 shadow-2xl shadow-blue-900/10 ring-1 ring-blue-500/20 relative overflow-hidden">
               <div className="absolute inset-0 bg-blue-500/5 animate-pulse pointer-events-none"></div>
              <h3 className="text-xl font-bold text-blue-400 mb-6 flex items-center gap-2 relative z-10">
                <CheckCircle2 className="h-6 w-6" /> CloseOS : All-in-One
              </h3>
              <div className="space-y-4 text-sm text-white relative z-10">
                 <div className="flex items-center justify-center p-8 bg-blue-600/20 border border-blue-500/30 rounded-xl">
                    <div className="text-center">
                       <Target className="h-12 w-12 text-blue-400 mx-auto mb-3" />
                       <span className="text-lg font-bold">TOUT EST LÀ.</span>
                       <p className="text-blue-200 text-xs mt-2">CRM + Agenda + Booking + WhatsApp + Visio + Factures + KPIs</p>
                    </div>
                 </div>
              </div>
              <p className="mt-6 text-center text-blue-400 font-medium text-sm relative z-10">
                = 1 seul onglet. Focus total. Closing maximum.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- COMING SOON --- */}
      <section className="py-20 bg-[#0B1121]">
         <div className="mx-auto max-w-4xl px-6 text-center">
            <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-bold text-indigo-400 uppercase tracking-widest">
               Bientôt Disponible
            </span>
            <h2 className="text-3xl font-bold text-white mt-6 mb-12">Le Futur du Closing</h2>
            <div className="grid md:grid-cols-2 gap-6">
               <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex items-start gap-4 text-left">
                  <div className="p-3 rounded-lg bg-indigo-500/20"><BrainCircuit className="h-6 w-6 text-indigo-400"/></div>
                  <div>
                     <h3 className="font-bold text-white mb-1">Coach IA</h3>
                     <p className="text-sm text-slate-400">Analyse vos appels, détecte vos tics de langage et vous donne des conseils stratégiques pour closer plus.</p>
                  </div>
               </div>
               <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex items-start gap-4 text-left">
                  <div className="p-3 rounded-lg bg-indigo-500/20"><Smartphone className="h-6 w-6 text-indigo-400"/></div>
                  <div>
                     <h3 className="font-bold text-white mb-1">Téléphonie Pro</h3>
                     <p className="text-sm text-slate-400">Numéro dédié, Power Dialer pour enchaîner les appels, et enregistrement automatique.</p>
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
            Arrêtez de bricoler.<br/>Commencez à industrialiser.
          </h2>
          <p className="text-xl text-slate-300 mb-10">
            Rejoignez l'élite des closers qui utilisent CloseOS.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              to="/signup" 
              className="w-full sm:w-auto px-10 py-4 rounded-full bg-white text-slate-950 font-bold text-lg hover:bg-blue-50 hover:scale-105 transition-all flex items-center justify-center gap-2 shadow-xl shadow-white/10"
            >
              Créer mon compte gratuitement
              <ChevronRight className="h-5 w-5" />
            </Link>
          </div>
          <p className="mt-6 text-sm text-slate-500">
            Pas de carte bancaire requise. Annulation à tout moment.
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
            <span className="text-lg font-bold text-white">CloseOS</span>
          </div>
          <div className="text-slate-500 text-sm">
            © 2026 CloseOS. Fait avec ❤️ pour les closers.
          </div>
          <div className="flex gap-6">
            <a href="#" className="text-slate-500 hover:text-white transition-colors">Twitter</a>
            <a href="#" className="text-slate-500 hover:text-white transition-colors">LinkedIn</a>
            <a href="mailto:support@closeos.com" className="text-slate-500 hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}