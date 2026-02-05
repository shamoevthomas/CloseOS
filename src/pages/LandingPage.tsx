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
  LogIn
} from 'lucide-react'

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans selection:bg-blue-500/30">
      
      {/* --- NAVBAR --- */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/5 bg-[#020617]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-600 to-purple-600 shadow-lg shadow-blue-500/20">
              <Target className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">CloseOS</span>
          </div>

          {/* Liens Desktop (Optionnels) */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Fonctionnalités</a>
            <a href="#comparison" className="hover:text-white transition-colors">Comparatif</a>
            <a href="#pricing" className="hover:text-white transition-colors">Prix</a>
          </div>

          {/* Boutons d'action */}
          <div className="flex items-center gap-4">
            {/* ✅ BOUTON SE CONNECTER DEMANDÉ */}
            <Link 
              to="/login" 
              className="group flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              <LogIn className="h-4 w-4 text-slate-500 group-hover:text-white transition-colors" />
              Se connecter
            </Link>

            {/* Bouton CTA Principal */}
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
        {/* Effets de lumière (Background) */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-blue-600/20 opacity-30 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />
        <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-purple-600/10 opacity-20 blur-[100px] rounded-full pointer-events-none mix-blend-screen" />
        
        <div className="relative mx-auto max-w-7xl px-6 text-center z-10">
          
          {/* Badge Nouveauté */}
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 hover:bg-blue-500/20 transition-colors cursor-default">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            Nouveau : Intégration iClosed native
          </div>

          {/* Titre Principal */}
          <h1 className="mx-auto max-w-5xl text-5xl font-extrabold tracking-tight text-white sm:text-7xl mb-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
            Le CRM conçu pour <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 animate-gradient-x">
              exploser vos commissions
            </span>
          </h1>

          {/* Sous-titre */}
          <p className="mx-auto max-w-2xl text-lg text-slate-400 mb-10 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200 leading-relaxed">
            Arrêtez de gérer vos prospects sur Excel. <span className="text-white font-medium">CloseOS</span> automatise votre suivi, calcule vos commissions en temps réel et vous aide à closer plus, sans effort technique.
          </p>

          {/* Boutons Hero */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
            <Link 
              to="/signup" 
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-blue-600 text-white font-bold text-lg hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-1 flex items-center justify-center gap-2"
            >
              <Zap className="h-5 w-5 fill-current" />
              Commencer maintenant
            </Link>
            <Link to="/login" className="w-full sm:w-auto px-8 py-4 rounded-xl border border-slate-700 bg-slate-800/50 text-slate-300 font-semibold text-lg hover:bg-slate-800 hover:text-white transition-all flex items-center justify-center gap-2 backdrop-blur-sm">
              <Play className="h-5 w-5" />
              Voir la démo
            </Link>
          </div>

          {/* DASHBOARD PREVIEW (IMAGE) */}
          <div className="mt-20 relative mx-auto max-w-6xl animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-500 group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 rounded-2xl opacity-20 blur-lg group-hover:opacity-40 transition-opacity duration-1000"></div>
            <div className="relative rounded-xl border border-slate-800 bg-[#0B1121] shadow-2xl overflow-hidden ring-1 ring-white/10">
               {/* Place ici une belle capture d'écran de ton pipeline */}
               <img 
                 src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2670&auto=format&fit=crop" 
                 alt="Dashboard CloseOS" 
                 className="w-full h-auto opacity-90 transition-opacity hover:opacity-100" 
               />
               {/* Overlay gradient pour fondre l'image */}
               <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent opacity-80"></div>
            </div>
          </div>
        </div>
      </section>

      {/* --- SOCIAL PROOF (Logos) --- */}
      <section className="py-12 border-y border-white/5 bg-slate-950/50">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <p className="text-xs font-bold text-slate-500 mb-8 uppercase tracking-widest">
            Approuvé par l'élite du closing
          </p>
          <div className="flex flex-wrap justify-center gap-x-16 gap-y-8 opacity-40 grayscale hover:grayscale-0 transition-all duration-700">
            {/* Remplace par des vrais logos si tu en as, sinon texte stylisé */}
            <h3 className="text-2xl font-black text-white tracking-tighter">GENIX</h3>
            <h3 className="text-2xl font-black text-white tracking-tighter">CLOSEUP</h3>
            <h3 className="text-2xl font-black text-white tracking-tighter">HYPERION</h3>
            <h3 className="text-2xl font-black text-white tracking-tighter">SCALE</h3>
            <h3 className="text-2xl font-black text-white tracking-tighter">IMPACT</h3>
          </div>
        </div>
      </section>

      {/* --- FEATURES (Bento Grid) --- */}
      <section id="features" className="py-32 relative">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-20 text-center max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-white sm:text-5xl mb-6">Tout ce dont vous avez besoin.<br/>Rien de superflu.</h2>
            <p className="text-lg text-slate-400">
              Nous avons supprimé tout le bruit des CRM classiques (Salesforce, HubSpot) pour ne garder que ce qui fait <span className="text-emerald-400 font-semibold">gagner de l'argent</span> aux closers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 - Large (Commissions) */}
            <div className="md:col-span-2 rounded-3xl border border-slate-800 bg-slate-900/50 p-8 hover:border-blue-500/30 transition-all duration-500 group overflow-hidden relative hover:bg-slate-900/80">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-20 transition-opacity duration-500 transform group-hover:scale-110 group-hover:rotate-12">
                <BarChart3 className="w-64 h-64 text-blue-500" />
              </div>
              <div className="relative z-10">
                <div className="h-12 w-12 rounded-lg bg-blue-500/20 flex items-center justify-center mb-6 ring-1 ring-blue-500/30">
                  <TrendingUp className="h-6 w-6 text-blue-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Suivi des Commissions en Temps Réel</h3>
                <p className="text-slate-400 mb-6 max-w-md leading-relaxed">
                  Ne calculez plus jamais vos gains à la main. CloseOS détecte vos ventes, applique vos taux de commission (même complexes) et vous dit exactement combien vous allez toucher à la fin du mois.
                </p>
                <div className="flex items-center gap-4 text-sm font-semibold text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-lg w-fit border border-emerald-500/20">
                  <CheckCircle2 className="h-4 w-4" /> Prévisionnel automatique
                </div>
              </div>
            </div>

            {/* Feature 2 - Small (Webhook) */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-8 hover:border-purple-500/30 transition-all duration-500 group hover:bg-slate-900/80">
              <div className="h-12 w-12 rounded-lg bg-purple-500/20 flex items-center justify-center mb-6 ring-1 ring-purple-500/30">
                <Zap className="h-6 w-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Automatisation Webhook</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Connectez iClosed, Calendly ou n'importe quelle source. Vos prospects apparaissent instantanément dans votre pipeline avec la bonne offre. <br/><span className="text-purple-400">Zéro saisie manuelle.</span>
              </p>
            </div>

            {/* Feature 3 - Small (Sécurité) */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-8 hover:border-emerald-500/30 transition-all duration-500 group hover:bg-slate-900/80">
              <div className="h-12 w-12 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-6 ring-1 ring-emerald-500/30">
                <Shield className="h-6 w-6 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Sécurité & Données</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Vos leads sont à vous. Exportez vos données en un clic. Nous ne vendons pas vos données, nous les sécurisons avec les standards bancaires.
              </p>
            </div>

            {/* Feature 4 - Large (Pipeline) */}
            <div className="md:col-span-2 rounded-3xl border border-slate-800 bg-slate-900/50 p-8 hover:border-orange-500/30 transition-all duration-500 group overflow-hidden relative hover:bg-slate-900/80">
               <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-20 transition-opacity duration-500 transform group-hover:-rotate-12 group-hover:scale-110">
                <Trophy className="w-64 h-64 text-orange-500" />
              </div>
              <div className="relative z-10">
                <div className="h-12 w-12 rounded-lg bg-orange-500/20 flex items-center justify-center mb-6 ring-1 ring-orange-500/30">
                  <PieChart className="h-6 w-6 text-orange-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Pipeline Visuel Intuitif</h3>
                <p className="text-slate-400 mb-6 max-w-md leading-relaxed">
                  Une vue Kanban ultra-rapide pour déplacer vos prospects. Identifiez en un coup d'œil qui relancer aujourd'hui pour closer demain.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3 text-sm text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-blue-500" /> Glisser-déposer fluide & instantané
                  </li>
                  <li className="flex items-center gap-3 text-sm text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-blue-500" /> Filtres intelligents par offre
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- COMPARISON SECTION --- */}
      <section id="comparison" className="py-24 bg-slate-900/30 border-y border-white/5 relative">
        <div className="mx-auto max-w-5xl px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white">Pourquoi changer ?</h2>
            <p className="text-slate-400 mt-4">La différence entre un Amateur et un Pro se joue sur l'organisation.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* The Old Way */}
            <div className="rounded-2xl border border-red-900/20 bg-red-950/5 p-8 opacity-75 hover:opacity-100 transition-opacity">
              <h3 className="text-xl font-bold text-red-400 mb-6 flex items-center gap-2">
                <XCircle className="h-6 w-6" /> La méthode Excel / Notion
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-slate-400">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                  Saisie manuelle interminable après chaque appel
                </li>
                <li className="flex items-start gap-3 text-slate-400">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                  Erreurs de calcul sur les commissions
                </li>
                <li className="flex items-start gap-3 text-slate-400">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                  Oubli de relances (perte d'argent directe)
                </li>
                <li className="flex items-start gap-3 text-slate-400">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                  Interface lente, moche et non pensée pour la vente
                </li>
              </ul>
            </div>

            {/* The CloseOS Way */}
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-8 shadow-2xl shadow-emerald-900/10 ring-1 ring-emerald-500/20">
              <h3 className="text-xl font-bold text-emerald-400 mb-6 flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6" /> La méthode CloseOS
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-white">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                  Import automatique des leads depuis iClosed
                </li>
                <li className="flex items-start gap-3 text-white">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                  Calcul des commissions au centime près
                </li>
                <li className="flex items-start gap-3 text-white">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                  Pipeline visuel qui incite à l'action
                </li>
                <li className="flex items-start gap-3 text-white">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                  Design sombre reposant pour les yeux
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* --- CTA FINAL --- */}
      <section className="relative py-32 overflow-hidden">
        {/* Effet Glow Final */}
        <div className="absolute inset-0 bg-blue-600/10 blur-[100px] rounded-full pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        
        <div className="relative mx-auto max-w-4xl px-6 text-center z-10">
          <h2 className="text-4xl font-bold text-white mb-6">
            Prêt à passer au niveau supérieur ?
          </h2>
          <p className="text-xl text-slate-300 mb-10">
            Rejoignez les closers qui utilisent CloseOS pour sécuriser leurs commissions et gagner du temps.
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