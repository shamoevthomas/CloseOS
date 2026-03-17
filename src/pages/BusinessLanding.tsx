import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import {
  ArrowUp,
  ArrowDown,
  Layers,
  Bell,
  Tag,
  Shield,
  Mail,
  Phone,
  MessageSquare,
  CheckCircle,
  Plus,
  FileText,
  Video,
  X,
  Loader2,
  ExternalLink,
  ChevronDown,
  Menu
} from 'lucide-react';

export const BusinessLanding: React.FC = () => {
  const navigate = useNavigate();
  const pageRef = useRef<HTMLDivElement>(null);
  const [isExiting, setIsExiting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleNavigateToSales = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsExiting(true);
    setTimeout(() => navigate('/landing'), 500);
  };

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);

    // Chatbot initialization
    const s = document.createElement('script');
    s.src = '/chatbot-widget.js';
    s.setAttribute('data-chatbot-id', 'acb35233-a6de-4738-9ba0-7e25c82c2a61');
    s.setAttribute('data-supabase-url', 'https://mkxcircbzcsjamslijde.supabase.co');
    s.setAttribute('data-supabase-key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1reGNpcmNiemNzamFtc2xpamRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MjM0MDAsImV4cCI6MjA4NzQ5OTQwMH0.9-abq1tEFsmjfRkLJjrkXlG3z-9o2HKYjyp5eBIl178');
    document.body.appendChild(s);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (document.body.contains(s)) {
        document.body.removeChild(s);
      }
      const chatbotContainer = document.getElementById('chatbot-widget-container');
      if (chatbotContainer) {
        chatbotContainer.remove();
      }
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div ref={pageRef} className={`bg-[#f4f2f1] font-sans text-[#111111] min-h-screen selection:bg-[#8a43e1]/20 transition-all duration-500 ${isExiting ? 'translate-y-full opacity-0' : 'animate-[pageEnterFromTop_0.5s_ease-out]'}`}>
      
      {/* Navigation */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-5xl">
        <div className="bg-white/80 backdrop-blur-md border border-stone-200/50 rounded-2xl px-6 py-3 flex items-center justify-between shadow-sm">
          <div className="relative group flex items-center gap-1 cursor-pointer">
            <img
              alt="CloseOS Logo"
              className="w-auto object-contain h-[72px]"
              src="/CloseOS Buisness.png"
            />
            <ChevronDown className="h-4 w-4 text-stone-400 group-hover:text-stone-800 transition-transform duration-300 group-hover:rotate-180" />
            <div className="absolute top-full left-0 right-0 mt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 translate-y-2 group-hover:translate-y-0">
              <a onClick={handleNavigateToSales} className="block rounded-xl border border-white/10 bg-[#020617] p-3 shadow-xl hover:bg-[#0f172a] transition-colors cursor-pointer">
                <img src="/logo Sales.png" alt="CloseOS Sales" className="w-full h-auto" />
              </a>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-stone-600">
            <a href="#features" className="hover:text-[#111111] transition-colors">Fonctionnalités</a>
            <a href="#crm" className="hover:text-[#111111] transition-colors">CRM</a>
            <a href="#faq" className="hover:text-[#111111] transition-colors">FAQ</a>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsModalOpen(true)}
              className="hidden sm:flex items-center justify-center rounded-lg h-10 px-5 text-white text-sm font-semibold tracking-wide hover:opacity-90 transition-all bg-[#111111]"
            >
              Rejoindre la liste d'attente
            </button>
            <button className="md:hidden p-2 text-stone-600">
              <Menu className="size-5" />
            </button>
          </div>
        </div>
      </nav>

      <main className="flex flex-col flex-1 pt-32">
        {/* Hero Section */}
        <section className="px-6 md:px-20 py-16 md:py-24 max-w-6xl mx-auto text-center relative">
          
          {/* Abstract Background Blobs */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[500px] opacity-30 pointer-events-none -z-10">
            <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-[#ff2f2f] rounded-full mix-blend-multiply filter blur-[100px] animate-blob"></div>
            <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-[#ef7b16] rounded-full mix-blend-multiply filter blur-[100px] animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-8 left-1/3 w-64 h-64 bg-[#8a43e1] rounded-full mix-blend-multiply filter blur-[100px] animate-blob animation-delay-4000"></div>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center gap-8 max-w-4xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-stone-200 shadow-sm">
              <span className="text-sm font-medium text-stone-800">
                🚀 Déjà <span className="font-bold bg-gradient-to-r from-[#ff2f2f] via-[#ef7b16] to-[#d511fd] text-transparent bg-clip-text">+150 closers</span> qui valident CloseOS Sales
              </span>
            </div>

            <h1 className="text-5xl md:text-7xl lg:text-[80px] font-bold leading-[1.1] tracking-tight text-[#111111]">
              L'écosystème ultime pour piloter votre business.
            </h1>
            
            <p className="text-stone-600 text-lg md:text-xl font-medium leading-relaxed max-w-2xl">
              Gérez vos ventes, pilotez vos équipes et automatisez votre croissance. L'infrastructure complète pour prendre le contrôle total de votre empire d'infoproduits et scaler sereinement.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-4">
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex min-w-[200px] items-center justify-center rounded-xl h-14 px-8 text-white text-lg font-semibold shadow-lg hover:-translate-y-1 transition-all bg-[#111111]"
              >
                S'inscrire pour le lancement
              </button>
            </div>

            <div className="flex items-center gap-3 mt-8">
              <div className="flex -space-x-3">
                {[1,2,3,4].map((i) => (
                  <div key={i} className="w-10 h-10 rounded-full border-2 border-[#f4f2f1] bg-stone-200 flex items-center justify-center overflow-hidden">
                    <img src={`https://i.pravatar.cc/100?img=${i+10}`} alt="User" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
              <div className="flex flex-col items-start text-sm">
                <div className="flex text-amber-400">
                  {'★★★★★'.split('').map((star, i) => <span key={i}>{star}</span>)}
                </div>
                <span className="text-stone-500 font-medium">4.9 rating <span className="text-stone-400">Based on 150+ Users</span></span>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Dashboard Macro Section (Bento Grid) */}
        <section className="px-6 md:px-20 py-24 max-w-7xl mx-auto" id="features">
          <div className="text-center mb-16 space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-stone-200 shadow-sm mb-4">
              <span className="text-sm font-semibold text-stone-800">Powerful Features</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-[#111111] tracking-tight">Work Smarter with Powerful Features</h2>
            <p className="text-stone-600 text-lg max-w-2xl mx-auto">Effortlessly manage tasks, collaborate with teams, and meet deadlines with precision and clarity.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Macro Dashboard */}
            <div className="lg:col-span-3 bg-white rounded-3xl p-8 border border-stone-200 shadow-sm">
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-[#111111] mb-2">Tableau de Bord Macro</h3>
                <p className="text-stone-500">Suivez vos KPIs stratégiques en temps réel pour prendre les meilleures décisions.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPIBox title="CA Total" value="145,000€" change="+15%" icon={<ArrowUp className="text-emerald-500 size-5" />} positive={true} />
                <KPIBox title="CA par Closer" value="12,400€" change="+5%" icon={<ArrowUp className="text-emerald-500 size-5" />} positive={true} />
                <KPIBox title="Taux de Closing" value="28%" change="-2%" icon={<ArrowDown className="text-rose-500 size-5" />} positive={false} />
                <KPIBox title="Taux de No-show" value="12%" change="-4%" icon={<ArrowDown className="text-rose-500 size-5" />} positive={false} />
              </div>
            </div>

            {/* Team Management */}
            <div className="lg:col-span-2 bg-white rounded-3xl p-8 border border-stone-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center mb-6">
                  <Layers className="size-6 text-stone-800" />
                </div>
                <h3 className="text-2xl font-bold text-[#111111] mb-3">Gestion de l'Équipe simplifiée</h3>
                <p className="text-stone-500 mb-8">
                  Pilotez vos closers avec une précision chirurgicale. Visualisez qui est en ligne, gérez les performances individuelles et intégrez de nouveaux talents en un clic.
                </p>
              </div>
              <div className="space-y-3">
                <TeamMember name="Julien Durand" role="Closer Senior" conv="34%" />
                <TeamMember name="Marie Lefebvre" role="Closer Junior" conv="21%" />
              </div>
            </div>

            {/* Shared Pipeline */}
            <div className="lg:col-span-1 bg-white rounded-3xl p-8 border border-stone-200 shadow-sm flex flex-col">
              <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center mb-6">
                <Tag className="size-6 text-stone-800" />
              </div>
              <h3 className="text-2xl font-bold text-[#111111] mb-3">Pipeline Partagé</h3>
              <p className="text-stone-500 mb-8">
                Un kanban visuel clair avec code couleur et drag-and-drop pour un suivi impeccable.
              </p>
              <div className="mt-auto bg-stone-50 rounded-2xl p-4 border border-stone-100">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-500">RDV Fixé</span>
                  <span className="text-xs font-bold text-stone-400">12</span>
                </div>
                <PipelineCard name="Michel Robert" source="MAI 24 - 14:00" highlight={false} />
              </div>
            </div>

            {/* Onboarding */}
            <div className="lg:col-span-3 bg-[#111111] rounded-3xl p-8 md:p-12 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#ff2f2f]/20 to-[#8a43e1]/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 relative z-10">
                <div className="flex flex-col justify-center">
                  <span className="text-stone-400 font-bold text-sm tracking-[0.2em] uppercase mb-4">Autonomie Totale</span>
                  <h3 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">Onboarding des closers simplifié</h3>
                  <p className="text-stone-300 text-lg mb-8 leading-relaxed">
                    Arrêtez de perdre du temps à former chaque nouveau closer manuellement. Notre système automatisé les guide de A à Z avec vos scripts, ressources et KPIs de suivi de progression.
                  </p>
                  <ul className="space-y-4">
                    <li className="flex items-center gap-3 text-stone-200 font-medium">
                      <CheckCircle className="text-emerald-400 size-5" /> Monday Morning Reporting (Auto)
                    </li>
                    <li className="flex items-center gap-3 text-stone-200 font-medium">
                      <CheckCircle className="text-emerald-400 size-5" /> Exports hebdomadaires par email
                    </li>
                  </ul>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <BoxItem icon={<FileText className="size-6 text-white" />} title="Scripts & Playbooks" description="Centralisez vos meilleures méthodes." dark />
                  <BoxItem icon={<Video className="size-6 text-white" />} title="Vidéos de Formation" description="Onboarding 100% autonome." dark />
                  <BoxItem icon={<CheckCircle className="size-6 text-white" />} title="Suivi Progression" description="Vérifiez les acquis avant le 1er call." dark />
                  <BoxItem icon={<ArrowDown className="size-6 text-white" />} title="Exports Auto" description="Data exportable en CSV/PDF." dark />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CRM Feature Teaser */}
        <section className="px-6 md:px-20 py-32 bg-white border-y border-stone-200 relative overflow-hidden" id="crm">
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-20">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-stone-100 border border-stone-200 shadow-sm mb-6">
                <span className="text-sm font-semibold text-stone-800 uppercase tracking-widest">L'outil tout-en-un</span>
              </div>
              <h2 className="text-5xl md:text-6xl font-bold mb-6 text-[#111111] tracking-tight">CloseOS devient votre Système d'acquisition</h2>
              <p className="text-stone-500 text-xl max-w-3xl mx-auto font-medium">
                Oubliez la complexité de HubSpot ou Notion. Profitez d'un CRM conçu exclusivement pour le closing haute performance.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-20">
              <div className="lg:col-span-7">
                <LeadProfile />
              </div>
              <div className="lg:col-span-5 flex flex-col justify-center gap-4">
                <CRMFeature icon={<Layers className="size-5" />} title="Pipeline CRM indépendant" description="Double vue stratégique : vue individuelle pour chaque closer vs vue globale temps réel pour l'infopreneur." />
                <CRMFeature icon={<Bell className="size-5" />} title="Relances automatiques" extra={<div className="mt-3 bg-amber-100 text-amber-800 px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 w-fit"><ArrowUp className="size-3.5" /> RAPPELER DANS 3 JOURS</div>} />
                <CRMFeature icon={<Tag className="size-5" />} title="Tags illimités & Filtres" extra={<div className="flex gap-2 mt-3 text-left"><span className="px-2.5 py-1 rounded-md bg-stone-100 text-stone-600 text-xs font-semibold border border-stone-200">Froid</span><span className="px-2.5 py-1 rounded-md bg-stone-100 text-stone-600 text-xs font-semibold border border-stone-200">Rappel</span><span className="px-2.5 py-1 rounded-md bg-stone-100 text-stone-600 text-xs font-semibold border border-stone-200">Urgent</span></div>} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-16 border-t border-stone-200">
              <CRMKPI title="KPI CRM • Pipeline" value="452,000€" description="Valeur totale du pipeline en cours" />
              <CRMKPI title="KPI CRM • Performance" value="4,850€" description="Deal moyen encaissé" />
              <CRMKPI title="KPI CRM • Vélocité" value="12 Jours" description="Cycle de vente moyen (Lead to Close)" />
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="px-6 md:px-20 py-32 bg-[#f4f2f1]" id="faq">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-16 space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-stone-200 shadow-sm mb-4">
                <span className="text-sm font-semibold text-stone-800">FAQs</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-[#111111] tracking-tight">Questions fréquentes</h2>
              <p className="text-stone-500 text-lg">Tout ce que vous devez savoir avant de rejoindre la liste d'attente.</p>
            </div>
            <div className="space-y-4">
              <FAQItem
                question="CloseOS Business est-il compatible avec mes outils CRM actuels ?"
                answer={<p>Oui. Tu peux connecter ton CRM existant — <strong>iClosed</strong>, <strong>HubSpot</strong> ou <strong>Pipedrive</strong> sont supportés. Cela dit, nous recommandons d'utiliser le <strong>CRM intégré CloseOS Business</strong> : c'est lui qui offre les meilleures performances et la gestion la plus simple dans cet écosystème. Tout est conçu pour fonctionner ensemble, sans friction.</p>}
              />
              <FAQItem
                question="Mes données sont-elles sécurisées et conformes au RGPD ?"
                answer={<p>Oui. CloseOS Business est <strong>100% conforme au RGPD</strong>. Toutes les données sont hébergées de manière sécurisée, isolées par organisation, et aucun tiers n'y a accès. Tu restes propriétaire de tes données à tout moment.</p>}
              />
              <FAQItem
                question="Mes closers ont-ils accès à toutes les données ?"
                answer={<p>Non. Tu définis toi-même les niveaux d'accès. Chaque closer voit uniquement ses prospects, ses KPIs et son pipeline. Les données sensibles (CA global, marges, contacts stratégiques) restent visibles par toi seul.</p>}
              />
              <FAQItem
                question="Combien de closers puis-je ajouter ?"
                answer={<p>Autant que tu veux. CloseOS Business n'impose <strong>aucune limite</strong> sur la taille de ton équipe.</p>}
              />
              <FAQItem
                question="Est-ce difficile à prendre en main pour mes closers ?"
                answer={<p>Non. L'onboarding est <strong>100% autonome</strong> — tes closers sont guidés dès leur première connexion avec tes scripts, ressources et KPIs de progression. Tu n'as rien à expliquer manuellement.</p>}
              />
              <FAQItem
                question="Est-ce que CloseOS Business sera parfaitement adapté à mon business ?"
                answer={<p>C'est justement l'objectif. <strong>CloseOS Business se construit avec les infopreneurs inscrits sur la liste d'attente.</strong> Tes retours, tes besoins et tes cas d'usage concrets façonnent directement l'outil. Tu ne découvres pas un produit fini — tu participes à créer le meilleur outil de closing du marché.</p>}
              />
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-6 md:px-20 py-32 bg-white text-center border-t border-stone-200">
          <div className="max-w-3xl mx-auto space-y-10">
            <h2 className="text-5xl md:text-6xl font-bold leading-tight tracking-tight text-[#111111]">Prêt à scaler votre écosystème de closing ?</h2>
            <p className="text-stone-500 text-xl">Rejoignez la liste d'attente aujourd'hui et bénéficiez d'un accès prioritaire lors du lancement.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <button
                onClick={() => setIsModalOpen(true)}
                className="w-full sm:w-auto flex min-w-[240px] items-center justify-center rounded-xl h-16 px-10 text-white text-lg font-semibold shadow-xl hover:-translate-y-1 transition-all bg-[#111111]"
              >
                Être informé de l'ouverture
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="px-6 md:px-20 py-12 border-t border-stone-200 bg-[#f4f2f1] flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <img
            alt="CloseOS Logo"
            className="w-auto object-contain h-[72px]"
            src="/CloseOS Buisness.png"
          />
        </div>
        <p className="text-stone-500 text-sm font-medium">© 2026 CloseOS. All rights reserved.</p>
        <div className="flex gap-6 text-sm font-medium text-stone-500">
          <a href="#" className="hover:text-[#111111] transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-[#111111] transition-colors">Terms of Service</a>
        </div>
      </footer>

      <WaitingListModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      {/* Floating Scroll to Top Button */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-8 left-8 z-[90] p-4 rounded-full bg-white border border-stone-200 shadow-lg transition-all duration-500 hover:scale-110 hover:-translate-y-1 group ${showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}
        aria-label="Retour en haut"
      >
        <ArrowUp className="size-5 text-stone-800 group-hover:animate-bounce" />
      </button>

      <style>{`
        @keyframes pageEnterFromTop {
          from { opacity: 0; transform: translateY(-60px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}

// --- Sub-components ---

const KPIBox = ({ title, value, change, icon, positive }: any) => (
  <div className="bg-stone-50 p-6 rounded-2xl border border-stone-100 flex flex-col gap-3 hover:shadow-md transition-all duration-300">
    <div className="flex items-center justify-between">
      <span className="text-stone-500 text-xs font-bold uppercase tracking-widest">{title}</span>
      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-stone-100">
        {icon}
      </div>
    </div>
    <p className="text-[#111111] text-3xl font-bold tracking-tight">{value}</p>
    <p className={`${positive ? 'text-emerald-600' : 'text-rose-500'} text-xs font-semibold flex items-center gap-1`}>
      {change} vs mois dernier
    </p>
  </div>
);

const TeamMember = ({ name, role, conv }: any) => (
  <div className="flex items-center justify-between p-4 bg-stone-50 rounded-xl border border-stone-100 hover:shadow-sm transition-all duration-300">
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center font-bold text-stone-600 text-sm">
        {name.split(' ').map((n: string) => n[0]).join('')}
      </div>
      <div>
        <p className="text-[#111111] font-bold text-sm">{name}</p>
        <p className="text-stone-500 text-xs font-medium">{role}</p>
      </div>
    </div>
    <div className="text-right flex flex-col items-end gap-1">
      <p className="text-[#111111] font-bold text-sm">{conv} Conv.</p>
      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-bold uppercase tracking-wider">Online</span>
    </div>
  </div>
);

const PipelineCard = ({ name, source, time, highlight }: any) => (
  <div className={`p-4 rounded-xl shadow-sm border space-y-3 text-left transition-all duration-300 bg-white border-stone-200`}>
    <p className={`text-[#111111] font-bold text-sm`}>{name}</p>
    <div className="flex justify-between items-center">
      <span className={`text-[10px] bg-stone-100 text-stone-600 px-2 py-1 rounded-md font-bold uppercase tracking-wider`}>{source}</span>
      {time && <span className="text-stone-400 text-[10px] font-medium">{time}</span>}
    </div>
  </div>
);

const BoxItem = ({ icon, title, description, dark }: any) => (
  <div className={`${dark ? 'bg-white/5 border-white/10' : 'bg-stone-50 border-stone-100'} p-6 rounded-2xl border text-left`}>
    <div className="mb-4 bg-white/10 w-12 h-12 rounded-xl flex items-center justify-center">{icon}</div>
    <h4 className={`font-bold mb-2 ${dark ? 'text-white' : 'text-[#111111]'}`}>{title}</h4>
    <p className={`text-sm font-medium ${dark ? 'text-stone-400' : 'text-stone-500'}`}>{description}</p>
  </div>
);

const CRMFeature = ({ icon, title, description, extra }: any) => (
  <div className="bg-stone-50 hover:bg-stone-100 border border-stone-200 p-5 rounded-2xl transition-all group text-left">
    <div className="flex gap-4">
      <div className="size-10 rounded-xl bg-white border border-stone-200 shadow-sm flex items-center justify-center text-stone-800 flex-shrink-0">{icon}</div>
      <div className="flex-1">
        <h4 className="font-bold text-[#111111] mb-1">{title}</h4>
        {description && <p className="text-sm text-stone-500 font-medium">{description}</p>}
        {extra}
      </div>
    </div>
  </div>
);

const CRMKPI = ({ title, value, description }: any) => (
  <div className="flex flex-col gap-2 items-center text-center p-6 rounded-3xl bg-stone-50 border border-stone-200">
    <span className="text-stone-400 text-[10px] font-bold uppercase tracking-[0.2em]">{title}</span>
    <h4 className="text-4xl font-bold text-[#111111] tracking-tight my-2">{value}</h4>
    <p className="text-stone-500 text-sm font-medium">{description}</p>
  </div>
);

const LeadProfile = () => (
  <div className="bg-white rounded-3xl overflow-hidden shadow-xl border border-stone-200 text-left">
    <div className="p-6 border-b border-stone-100 bg-stone-50 flex justify-between items-center">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#ff2f2f] to-[#8a43e1] flex items-center justify-center text-white font-bold text-xl shadow-inner">JP</div>
        <div>
          <h4 className="font-bold text-xl text-[#111111] mb-1">Jean-Philippe Morel</h4>
          <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">ID: #89234 • Ajouté hier</span>
        </div>
      </div>
      <div className="hidden sm:flex gap-2">
        <span className="px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg text-[10px] font-bold uppercase tracking-wider">Chaud 🔥</span>
        <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-bold uppercase tracking-wider">Ready to Buy</span>
      </div>
    </div>
    <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="space-y-8">
        <div>
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3">Infos Contact</p>
          <div className="space-y-3 text-sm font-medium text-stone-700">
            <div className="flex items-center gap-3"><Mail className="size-4 text-stone-400" /> jp.morel@gmail.com</div>
            <div className="flex items-center gap-3"><Phone className="size-4 text-stone-400" /> +33 6 12 34 56 78</div>
            <div className="flex items-center gap-3"><ArrowUp className="size-4 text-stone-400" /> Source: <span className="text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded">Ads Instagram</span></div>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3">Historique d'Interaction</p>
          <div className="space-y-4">
            <InteractionItem icon={<MessageSquare className="size-3" />} text='"Je suis intéressé par le programme Mastermind..."' subtext="WhatsApp - 10:45" color="bg-emerald-100 text-emerald-700" italic={true} />
            <InteractionItem icon={<Phone className="size-3" />} text="Discovery Call complété (12 min)" subtext="Hier - 16:30" color="bg-sky-100 text-sky-700" />
          </div>
        </div>
      </div>
      <div className="space-y-8">
        <div className="bg-stone-50 p-5 rounded-2xl border border-stone-200">
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3">Notes & Objections</p>
          <p className="text-sm text-stone-600 font-medium leading-relaxed">
            - Frein principal : Disponibilité immédiate.<br />
            - OK sur le prix (7,500€).<br />
            - Proposer l'accès direct aux modules si paiement aujourd'hui.
          </p>
        </div>
        <div className="p-5 border border-stone-200 rounded-2xl bg-white shadow-sm">
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3">Offre Présentée</p>
          <div className="flex items-center justify-between">
            <span className="font-bold text-stone-800">Accompagnement VIP</span>
            <span className="font-black text-xl text-[#111111]">7,500€</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const FAQItem = ({ question, answer }: { question: string; answer: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border border-stone-200 rounded-2xl overflow-hidden bg-white shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-6 text-left hover:bg-stone-50 transition-colors"
      >
        <span className="text-[#111111] font-bold text-lg pr-4">{question}</span>
        <span className={`text-stone-400 transition-transform duration-300 flex-shrink-0 ${isOpen ? 'rotate-45' : ''}`}>
          <Plus className="size-5" />
        </span>
      </button>
      {isOpen && (
        <div className="px-6 pb-6 text-stone-600 font-medium leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  );
};

const InteractionItem = ({ icon, text, subtext, color, italic }: any) => (
  <div className="flex gap-3 items-start">
    <div className={`w-7 h-7 rounded-full ${color} flex items-center justify-center flex-shrink-0`}>{icon}</div>
    <div>
      <div className={`text-sm font-medium text-stone-800 ${italic ? 'italic' : ''}`}>{text}</div>
      <div className="font-semibold text-[10px] text-stone-400 mt-1 uppercase tracking-wider">{subtext}</div>
    </div>
  </div>
);

const WaitingListModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');

    try {
      const { error } = await supabase
        .from('EmailBuis')
        .insert([{ email }]);

      if (error) {
        if (error.code === '23505') {
          setErrorMessage("Vous êtes déjà inscrit avec ce mail");
          setStatus('error');
          return;
        }
        throw error;
      }

      // Trigger welcome email via Brevo API
      try {
        await fetch('/api/business-welcome-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
      } catch (emailErr) {
        console.error('Error triggering welcome email:', emailErr);
      }

      setStatus('success');
      setEmail('');
    } catch (err: any) {
      console.error('Error joining waiting list:', err);
      setStatus('error');
      setErrorMessage(err.message || "Une erreur est survenue. Veuillez rééssayer.");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#111111]/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-stone-100 transition-colors text-stone-500"
        >
          <X className="size-5" />
        </button>

        <div className="p-8 pt-12 text-center">
          <div className="bg-stone-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Mail className="size-8 text-stone-800" />
          </div>

          {status === 'success' ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-[#111111] text-3xl font-bold tracking-tight">C'est noté ! 🚀</h3>
                <p className="text-stone-500 font-medium text-center">
                  Merci de votre intérêt. Regardez cette vidéo en attendant l'ouverture !
                </p>
              </div>

              <div className="relative pt-[56.25%] w-full rounded-2xl overflow-hidden shadow-md border border-stone-200 bg-black">
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src="https://www.youtube.com/embed/DP1me04gNbk?autoplay=1"
                  title="CloseOS Business Introduction"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>

              <div className="pt-4 flex flex-col gap-3">
                <a
                  href="https://whatsapp.com/channel/0029Vb7P4lqDDmFLVtD7Jn0s"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-[#25D366] text-white py-3.5 rounded-xl font-bold hover:opacity-90 transition-all shadow-sm"
                >
                  Canal WhatsApp
                  <ExternalLink className="size-4" />
                </a>
                <a
                  href="https://docs.google.com/forms/d/e/1FAIpQLSfG_km1jRFBreeHvhksMAvAxwokZEOdahTicsKikNwk71IUwg/viewform"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-[#111111] text-white py-3.5 rounded-xl font-bold hover:opacity-90 transition-all shadow-sm"
                >
                  Vos besoins (Google Form)
                  <ExternalLink className="size-4" />
                </a>
                <a
                  href="https://www.linkedin.com/in/thomas-shamoev/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-[#0A66C2] text-white py-3.5 rounded-xl font-bold hover:opacity-90 transition-all shadow-sm"
                >
                  Suivre sur LinkedIn
                  <ExternalLink className="size-4" />
                </a>
              </div>
            </div>
          ) : (
            <>
              <h3 className="text-[#111111] text-3xl font-bold mb-3 tracking-tight">Rejoindre la liste d'attente</h3>
              <p className="text-stone-500 mb-8 font-medium">
                Soyez parmi les premiers à piloter votre business avec le nouvel écosystème CloseOS.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative text-left">
                  <label htmlFor="email" className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1 mb-1 block">
                    Votre Email Professionnel
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    placeholder="votre@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-4 focus:ring-2 focus:ring-[#111111] focus:border-transparent outline-none transition-all text-stone-800 font-semibold placeholder:font-medium"
                  />
                </div>

                {status === 'error' && (
                  <p className="text-rose-500 text-xs font-bold text-left ml-1 italic">{errorMessage}</p>
                )}

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full bg-[#111111] text-white rounded-xl py-4 font-bold text-lg shadow-md hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === 'loading' ? (
                    <>
                      <Loader2 className="size-5 animate-spin" />
                      Inscription...
                    </>
                  ) : (
                    "M'inscrire maintenant"
                  )}
                </button>

                <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest text-center mt-4">
                  Accès prioritaire • Sans engagement
                </p>
              </form>
            </>
          )}
        </div>
      </motion.div>
      <div className="fixed inset-0 -z-10" onClick={onClose}></div>
    </div>
  );
};
