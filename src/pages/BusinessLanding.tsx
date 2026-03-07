import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
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
    ExternalLink
} from 'lucide-react';

export const BusinessLanding: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showScrollTop, setShowScrollTop] = useState(false);

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
            // Remove DOM elements injected by the chatbot
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
        <div className="bg-business-background-light dark:bg-business-background-dark font-business-display text-slate-900 dark:text-slate-100 transition-colors duration-300">
            <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden">
                {/* Header / Navigation */}
                <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-business-primary/10 px-6 md:px-20 py-4 bg-business-background-light/80 backdrop-blur-md sticky top-0 z-50">
                    <div className="flex items-center gap-3">
                        <img
                            alt="CloseOS Logo"
                            className="w-auto object-contain h-[72px]"
                            src="/CloseOS Buisness.png"
                        />
                    </div>
                    <nav className="hidden md:flex flex-1 justify-center gap-10">
                        <a className="text-business-primary/80 hover:text-business-primary text-sm font-semibold transition-colors cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Accès anticipé</a>
                        <a className="text-business-primary/80 hover:text-business-primary text-sm font-semibold transition-colors" href="#dashboard">Dashboard</a>
                        <a className="text-business-primary/80 hover:text-business-primary text-sm font-semibold transition-colors" href="#pipeline">Pipeline</a>
                        <a className="text-business-primary/80 hover:text-business-primary text-sm font-semibold transition-colors" href="#crm">CRM</a>
                    </nav>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="hidden sm:flex min-w-[120px] cursor-pointer items-center justify-center rounded-lg h-10 px-5 text-white text-sm font-bold tracking-wide hover:opacity-90 transition-all bg-[#493627]"
                        >
                            Rejoindre la liste d'attente
                        </button>
                    </div>
                </header>

                <main className="flex flex-col flex-1">
                    {/* Hero Section */}
                    <section className="px-6 md:px-20 py-16 md:py-24 max-w-[1200px] mx-auto text-center">
                        <div className="flex flex-col items-center gap-12 max-w-[800px]">
                            <div className="flex flex-col gap-8">
                                <div className="flex flex-col gap-4 items-center">
                                    <h1 className="text-business-primary font-business-serif text-5xl md:text-7xl font-bold leading-[1.1] tracking-tight">
                                        L'écosystème ultime pour piloter votre business.
                                    </h1>
                                    <p className="text-business-primary/70 text-lg md:text-xl font-medium leading-relaxed max-w-lg">
                                        Gérez vos ventes, pilotez vos équipes et automatisez votre croissance. L'infrastructure complète pour prendre le contrôle total de votre empire d'infoproduits et scaler sereinement.
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-4 justify-center">
                                    <button
                                        onClick={() => setIsModalOpen(true)}
                                        className="flex min-w-[200px] cursor-pointer items-center justify-center rounded-xl h-14 px-8 text-white text-lg font-bold shadow-lg shadow-black/20 hover:-translate-y-1 transition-all bg-[#493627]"
                                    >
                                        S'inscrire pour le lancement
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Dashboard Macro Section */}
                    <section className="px-6 md:px-20 py-20 bg-business-primary/5" id="dashboard">
                        <div className="max-w-[1200px] mx-auto">
                            <div className="mb-12">
                                <h2 className="text-business-primary font-business-serif text-4xl font-bold mb-4">Tableau de Bord Macro</h2>
                                <p className="text-business-primary/60 text-lg">Suivez vos KPIs stratégiques en temps réel pour prendre les meilleures décisions.</p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                <KPIBox title="CA Total" value="145,000€" change="+15%" icon={<ArrowUp className="text-emerald-600 size-5" />} positive={true} />
                                <KPIBox title="CA par Closer" value="12,400€" change="+5%" icon={<ArrowUp className="text-emerald-600 size-5" />} positive={true} />
                                <KPIBox title="Taux de Closing" value="28%" change="-2%" icon={<ArrowDown className="text-rose-500 size-5" />} positive={false} />
                                <KPIBox title="Taux de No-show" value="12%" change="-4%" icon={<ArrowDown className="text-rose-500 size-5" />} positive={false} />
                            </div>
                        </div>
                    </section>

                    {/* Team Management Section */}
                    <section className="px-6 md:px-20 py-24 max-w-[1200px] mx-auto" id="features">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
                            <div className="flex flex-col gap-10">
                                <div className="flex flex-col gap-4">
                                    <span className="text-business-primary font-bold text-sm tracking-[0.2em] uppercase">Scalez votre force de vente</span>
                                    <h2 className="text-business-primary font-business-serif text-5xl font-bold leading-tight">Gestion de l'Équipe simplifiée</h2>
                                    <p className="text-business-primary/70 text-lg leading-relaxed">
                                        Pilotez vos closers avec une précision chirurgicale. Visualisez qui est en ligne, gérez les performances individuelles et intégrez de nouveaux talents en un clic.
                                    </p>
                                </div>
                                <div className="space-y-4">
                                    <FeatureItem
                                        icon={<Layers className="size-6" />}
                                        title="Gestion Multi-Rôles"
                                        description="Attribuez des accès spécifiques pour vos Setters, Closers, Head of Sales et Gérants avec une précision totale."
                                    />
                                    <FeatureItem
                                        icon={<Plus className="size-6" />}
                                        title="Lien d'Invitation Rapide"
                                        description="Générez un lien magique pré-configuré pour embarquer vos collaborateurs selon leur niveau de responsabilité."
                                    />
                                </div>
                            </div>
                            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-business-primary/10 shadow-xl overflow-hidden p-6">
                                <div className="flex items-center justify-between mb-8">
                                    <h3 className="font-bold text-business-primary">Team Activity</h3>
                                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold uppercase">6 Online</span>
                                </div>
                                <div className="space-y-4">
                                    <TeamMember name="Julien Durand" role="Closer Senior" conv="34%" />
                                    <TeamMember name="Marie Lefebvre" role="Closer Junior" conv="21%" />
                                    <TeamMember name="Sarah Lucas" role="Top Performer" conv="42%" />
                                </div>
                                <button className="w-full mt-6 py-4 rounded-xl border-2 border-dashed border-business-primary/20 text-business-primary/60 font-bold hover:bg-business-primary/5 transition-all">
                                    + Inviter un closer
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* Pipeline Partagé Section */}
                    <section className="px-6 md:px-20 py-24 bg-business-primary/10" id="pipeline">
                        <div className="max-w-[1200px] mx-auto">
                            <div className="text-center mb-16 space-y-4">
                                <h2 className="text-business-primary font-business-serif text-5xl font-bold">Pipeline Partagé</h2>
                                <p className="text-business-primary/70 text-lg max-w-2xl mx-auto">Plus de confusion entre vos outils. Un kanban visuel clair avec code couleur et drag-and-drop pour un suivi impeccable.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 overflow-x-auto pb-4">
                                <PipelineColumn title="New Lead" color="bg-amber-400" count={4}>
                                    <PipelineCard name="Jean Dupont" source="ADS FB" time="2h ago" />
                                    <PipelineCard name="Alice Bernard" source="ORGANIC" time="5h ago" />
                                </PipelineColumn>
                                <PipelineColumn title="RDV Fixé" color="bg-sky-400" count={12}>
                                    <PipelineCard name="Michel Robert" source="MAI 24 - 14:00" />
                                </PipelineColumn>
                                <PipelineColumn title="Call Fait" color="bg-indigo-500" count={8}>
                                    <PipelineCard name="Emma Petit" source="READY TO BUY" />
                                </PipelineColumn>
                                <PipelineColumn title="Payé" color="bg-emerald-500" count={24} highlight={true}>
                                    <PipelineCard name="Lucas Martin" source="2,500€" highlight={true} />
                                </PipelineColumn>
                            </div>
                        </div>
                    </section>

                    {/* Onboarding Section */}
                    <section className="px-6 md:px-20 py-24 max-w-[1200px] mx-auto">
                        <div className="flex flex-col lg:flex-row items-center gap-16">
                            <div className="flex-1 order-2 lg:order-1">
                                <div className="grid grid-cols-2 gap-4">
                                    <BoxItem icon={<FileText className="size-8" />} title="Scripts & Playbooks" description="Centralisez vos meilleures méthodes." />
                                    <BoxItem icon={<Video className="size-8" />} title="Vidéos de Formation" description="Onboarding 100% autonome." />
                                    <BoxItem icon={<CheckCircle className="size-8" />} title="Suivi Progression" description="Vérifiez les acquis avant le 1er call." />
                                    <BoxItem icon={<ArrowDown className="size-8" />} title="Exports Auto" description="Data exportable en CSV/PDF." />
                                </div>
                            </div>
                            <div className="flex-1 order-1 lg:order-2 space-y-6">
                                <span className="text-business-primary font-bold text-sm tracking-[0.2em] uppercase">Autonomie Totale</span>
                                <h2 className="text-business-primary font-business-serif text-5xl font-bold leading-tight">Onboarding des closers simplifié</h2>
                                <p className="text-business-primary/70 text-lg leading-relaxed">Arrêtez de perdre du temps à former chaque nouveau closer manuellement. Notre système automatisé les guide de A à Z avec vos scripts, ressources et KPIs de suivi de progression.</p>
                                <ul className="space-y-4">
                                    <li className="flex items-center gap-3 text-business-primary font-semibold">
                                        <CheckCircle className="text-emerald-500 size-5" /> Monday Morning Reporting (Auto)
                                    </li>
                                    <li className="flex items-center gap-3 text-business-primary font-semibold">
                                        <CheckCircle className="text-emerald-500 size-5" /> Exports hebdomadaires par email
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    {/* CRM Feature Teaser */}
                    <section className="px-6 md:px-20 py-24 bg-business-primary text-business-background-light overflow-hidden relative" id="crm">
                        <div className="max-w-[1200px] mx-auto flex flex-col items-center text-center relative z-10">
                            <div className="text-center mb-20">
                                <div className="inline-block px-4 py-1 rounded-full bg-business-background-light/10 text-business-background-light text-xs font-bold mb-6 backdrop-blur-sm border border-business-background-light/20 uppercase tracking-widest">
                                    L'outil tout-en-un
                                </div>
                                <h2 className="font-business-serif text-5xl md:text-7xl font-bold mb-6">CloseOS devient votre Système d'acquisition</h2>
                                <p className="text-business-background-light/70 text-xl max-w-3xl mx-auto font-medium">
                                    Oubliez la complexité de HubSpot ou Notion. Profitez d'un CRM conçu exclusivement pour le closing haute performance.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-20 w-full">
                                <div className="lg:col-span-7">
                                    <LeadProfile />
                                </div>
                                <div className="lg:col-span-5 grid grid-cols-1 gap-4">
                                    <CRMFeature icon={<Layers className="size-6" />} title="Pipeline CRM indépendant" description="Double vue stratégique : vue individuelle pour chaque closer vs vue globale temps réel pour l'infopreneur." />
                                    <CRMFeature icon={<Bell className="size-6" />} title="Relances automatiques" extra={<div className="mt-2 bg-amber-400 text-business-primary px-3 py-1 rounded text-[10px] font-extrabold flex items-center gap-2 w-fit"><ArrowUp className="size-3" /> RAPPELER DANS 3 JOURS</div>} />
                                    <CRMFeature icon={<Tag className="size-6" />} title="Tags illimités & Filtres" extra={<div className="flex gap-1 mt-2 text-left"><span className="px-2 py-0.5 rounded bg-white/10 text-[9px] font-bold">Froid</span><span className="px-2 py-0.5 rounded bg-white/10 text-[9px] font-bold">Rappel</span><span className="px-2 py-0.5 rounded bg-white/10 text-[9px] font-bold">Urgent</span></div>} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-12 border-t border-business-background-light/10 w-full">
                                <CRMKPI title="KPI CRM • Pipeline" value="452,000€" description="Valeur totale du pipeline en cours" />
                                <CRMKPI title="KPI CRM • Performance" value="4,850€" description="Deal moyen encaissé" />
                                <CRMKPI title="KPI CRM • Vélocité" value="12 Jours" description="Cycle de vente moyen (Lead to Close)" />
                            </div>

                            <div className="mt-16 flex items-center justify-center gap-4 text-sm opacity-50">
                                <Shield className="size-5" />
                                <p>Base de données partagée sécurisée avec niveaux de permissions granulaires</p>
                            </div>
                        </div>
                        {/* Abstract Design Elements */}
                        <div className="absolute top-0 right-0 w-96 h-96 bg-business-background-light/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                        <div className="absolute bottom-0 left-0 w-96 h-96 bg-business-background-light/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
                    </section>

                    {/* Final CTA */}
                    <section className="px-6 md:px-20 py-24 bg-business-background-light text-center">
                        <div className="max-w-[800px] mx-auto space-y-10">
                            <h2 className="text-business-primary font-business-serif text-5xl font-bold leading-tight">Prêt à scaler votre écosystème de closing ?</h2>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                <button
                                    onClick={() => setIsModalOpen(true)}
                                    className="w-full sm:w-auto flex min-w-[240px] cursor-pointer items-center justify-center rounded-xl h-16 px-10 text-white text-xl font-bold shadow-xl shadow-black/20 hover:scale-105 transition-all bg-[#493627]"
                                >
                                    Être informé de l'ouverture
                                </button>
                                <p className="text-business-primary/50 font-semibold italic">Pas de carte bancaire requise.</p>
                            </div>
                        </div>
                    </section>
                </main>

                <footer className="px-6 md:px-20 py-12 border-t border-business-primary/10 bg-business-background-light">
                    <img
                        alt="CloseOS Logo"
                        className="w-auto object-contain h-[72px]"
                        src="/CloseOS Buisness.png"
                    />
                </footer>

                <WaitingListModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

                {/* Floating Scroll to Top Button */}
                <button
                    onClick={scrollToTop}
                    className={`fixed bottom-8 left-8 z-[90] p-4 rounded-full bg-white/80 backdrop-blur-md border border-business-primary/10 shadow-xl transition-all duration-500 hover:scale-110 hover:-translate-y-1 group ${showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'
                        }`}
                    aria-label="Retour en haut"
                >
                    <ArrowUp className="size-6 text-[#493627] group-hover:animate-bounce" />
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-business-primary text-white text-[10px] font-bold py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap uppercase tracking-widest pointer-events-none">
                        Retour en haut
                    </div>
                </button>
            </div>
        </div>
    );
};

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
            // Insert into the new dedicated EmailBuis table
            const { error } = await supabase
                .from('EmailBuis')
                .insert([{ email }]);

            if (error) {
                // Postgres error code for unique constraint violation
                if (error.code === '23505') {
                    setErrorMessage("Vous êtes déjà inscrit avec ce mail");
                    setStatus('error');
                    return;
                }
                throw error;
            }

            // Trigger welcome email via Brevo API only for new signups
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-business-primary/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div
                className="bg-business-background-light w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full hover:bg-business-primary/10 transition-colors text-business-primary"
                >
                    <X className="size-6" />
                </button>

                <div className="p-8 pt-12 text-center">
                    <div className="bg-business-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Mail className="size-8 text-business-primary" />
                    </div>

                    {status === 'success' ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="space-y-2">
                                <h3 className="text-business-primary font-business-serif text-3xl font-bold">C'est noté ! 🚀</h3>
                                <p className="text-business-primary/70 font-medium text-center">
                                    Merci de votre intérêt. Regardez cette vidéo en attendant l'ouverture !
                                </p>
                            </div>

                            <div className="relative pt-[56.25%] w-full rounded-2xl overflow-hidden shadow-xl border border-business-primary/10 bg-black">
                                <iframe
                                    className="absolute inset-0 w-full h-full"
                                    src="https://www.youtube.com/embed/DP1me04gNbk?autoplay=1"
                                    title="CloseOS Business Introduction"
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    allowFullScreen
                                ></iframe>
                            </div>

                            <div className="pt-2 flex flex-col gap-3">
                                <a
                                    href="https://whatsapp.com/channel/0029Vb7P4lqDDmFLVtD7Jn0s"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 w-full bg-[#25D366] text-white py-3 rounded-xl font-bold hover:scale-[1.02] transition-all shadow-lg shadow-emerald-500/10"
                                >
                                    Canal WhatsApp
                                    <ExternalLink className="size-4" />
                                </a>
                                <a
                                    href="https://docs.google.com/forms/d/e/1FAIpQLSfG_km1jRFBreeHvhksMAvAxwokZEOdahTicsKikNwk71IUwg/viewform"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 w-full bg-business-primary text-white py-3 rounded-xl font-bold hover:scale-[1.02] transition-all shadow-lg"
                                >
                                    Vos besoins (Google Form)
                                    <ExternalLink className="size-4" />
                                </a>
                                <a
                                    href="https://www.linkedin.com/in/thomas-shamoev/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 w-full bg-[#0A66C2] text-white py-3 rounded-xl font-bold hover:scale-[1.02] transition-all shadow-lg shadow-blue-500/10"
                                >
                                    Suivre sur LinkedIn
                                    <ExternalLink className="size-4" />
                                </a>
                            </div>

                            <div className="pt-2 flex justify-center">
                                <CheckCircle className="size-8 text-emerald-500" />
                            </div>
                        </div>
                    ) : (
                        <>
                            <h3 className="text-business-primary font-business-serif text-3xl font-bold mb-3">Rejoindre la liste d'attente</h3>
                            <p className="text-business-primary/60 mb-8 font-medium">
                                Soyez parmi les premiers à piloter votre business avec le nouvel écosystème CloseOS.
                            </p>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="relative text-left">
                                    <label htmlFor="email" className="text-[10px] font-bold text-business-primary/40 uppercase tracking-widest ml-1 mb-1 block">
                                        Votre Email Professionnel
                                    </label>
                                    <input
                                        id="email"
                                        type="email"
                                        required
                                        placeholder="votre@email.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-business-primary/5 border border-business-primary/10 rounded-xl px-4 py-4 focus:ring-2 focus:ring-business-primary focus:border-transparent outline-none transition-all text-business-primary font-bold"
                                    />
                                </div>

                                {status === 'error' && (
                                    <p className="text-rose-500 text-xs font-bold text-left ml-1 italic">{errorMessage}</p>
                                )}

                                <button
                                    type="submit"
                                    disabled={status === 'loading'}
                                    className="w-full bg-business-primary text-white rounded-xl py-4 font-bold text-lg shadow-lg hover:shadow-business-primary/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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

                                <p className="text-[10px] text-business-primary/40 font-bold uppercase tracking-widest text-center">
                                    Accès prioritaire • Sans engagement
                                </p>
                            </form>
                        </>
                    )}
                </div>
            </div>
            {/* Background Overlay to close */}
            <div className="fixed inset-0 -z-10" onClick={onClose}></div>
        </div>
    );
};

const KPIBox = ({ title, value, change, icon, positive }: any) => (
    <div className="bg-business-background-light p-8 rounded-2xl border border-business-primary/10 flex flex-col gap-3 shadow-sm hover:scale-[1.02] transition-all duration-300 cursor-pointer">
        <div className="flex items-center justify-between">
            <span className="text-business-primary/60 text-sm font-bold uppercase tracking-widest">{title}</span>
            {icon}
        </div>
        <div className="bg-[#F3E5AB]/40 px-3 py-1 rounded-lg inline-block w-fit">
            <p className="text-business-primary text-4xl font-extrabold">{value}</p>
        </div>
        <p className={`${positive ? 'text-emerald-600' : 'text-rose-500'} text-sm font-bold flex items-center gap-1`}>
            {change} vs mois dernier
        </p>
    </div>
);

const FeatureItem = ({ icon, title, description }: any) => (
    <div className="flex items-start gap-4 p-5 rounded-2xl bg-business-primary/5 border border-business-primary/10 text-left">
        <div className="bg-business-primary text-business-background-light p-3 rounded-xl">
            {icon}
        </div>
        <div>
            <h4 className="text-business-primary font-bold text-lg">{title}</h4>
            <p className="text-business-primary/60">{description}</p>
        </div>
    </div>
);

const TeamMember = ({ name, role, conv }: any) => (
    <div className="flex items-center justify-between p-4 bg-business-primary/5 rounded-xl border border-business-primary/5 hover:scale-[1.02] transition-all duration-300 cursor-pointer">
        <div className="flex items-center gap-4 text-left">
            <div className="w-10 h-10 rounded-full bg-business-primary/20 flex items-center justify-center font-bold text-business-primary">
                {name.split(' ').map((n: string) => n[0]).join('')}
            </div>
            <div>
                <p className="text-business-primary font-bold text-sm">{name}</p>
                <p className="text-business-primary/50 text-xs">{role}</p>
            </div>
        </div>
        <div className="text-right">
            <p className="text-business-primary font-bold text-sm">{conv} Conv.</p>
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
        </div>
    </div>
);

const PipelineColumn = ({ title, color, count, children }: any) => (
    <div className="flex flex-col gap-4 min-w-[280px]">
        <div className="flex items-center justify-between px-2">
            <h4 className="text-business-primary font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${color}`}></span> {title}
            </h4>
            <span className="text-business-primary/40 font-bold text-sm">{count}</span>
        </div>
        {children}
    </div>
);

const PipelineCard = ({ name, source, time, highlight }: any) => (
    <div className={`${highlight ? 'bg-emerald-50 border-emerald-100' : 'bg-business-background-light border-business-primary/5'} p-4 rounded-xl shadow-sm border space-y-3 text-left hover:scale-[1.02] transition-all duration-300 cursor-pointer`}>
        <p className={`${highlight ? 'text-emerald-900' : 'text-business-primary'} font-bold text-sm`}>{name}</p>
        <div className="flex justify-between items-center">
            <span className={`text-[10px] ${highlight ? 'bg-emerald-500 text-white' : 'bg-business-primary/10 text-business-primary'} px-2 py-0.5 rounded font-bold uppercase`}>{source}</span>
            {time && <span className="text-business-primary/60 text-[10px]">{time}</span>}
        </div>
    </div>
);

const BoxItem = ({ icon, title, description }: any) => (
    <div className="bg-business-primary/5 p-6 rounded-2xl border border-business-primary/10 text-left">
        <div className="text-business-primary mb-4">{icon}</div>
        <h4 className="text-business-primary font-bold mb-2">{title}</h4>
        <p className="text-business-primary/60 text-sm">{description}</p>
    </div>
);

const CRMFeature = ({ icon, title, description, extra }: any) => (
    <div className="bg-business-background-light/5 hover:bg-business-background-light/10 border border-business-background-light/10 p-5 rounded-2xl transition-all group text-left">
        <div className="flex gap-4">
            <div className="size-12 rounded-full bg-emerald-400/10 flex items-center justify-center text-emerald-400 flex-shrink-0">{icon}</div>
            <div className="flex-1">
                <h4 className="font-bold mb-1">{title}</h4>
                {description && <p className="text-sm opacity-60">{description}</p>}
                {extra}
            </div>
        </div>
    </div>
);

const CRMKPI = ({ title, value, description }: any) => (
    <div className="flex flex-col gap-2 items-center">
        <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-[0.2em]">{title}</span>
        <div className="bg-[#F3E5AB]/20 p-2 rounded-lg flex items-center justify-center w-full max-w-[280px]">
            <h4 className="text-4xl font-business-serif font-bold">{value}</h4>
        </div>
        <p className="opacity-60 text-sm text-center">{description}</p>
    </div>
);

const LeadProfile = () => (
    <div className="bg-business-background-light text-business-primary rounded-3xl overflow-hidden shadow-2xl border border-white/10 text-left hover:scale-[1.02] transition-all duration-300 cursor-pointer">
        <div className="p-6 border-b border-business-primary/5 bg-business-primary/5 flex justify-between items-center">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-business-primary flex items-center justify-center text-business-background-light font-bold text-lg">JP</div>
                <div>
                    <h4 className="font-bold text-lg leading-none">Jean-Philippe Morel</h4>
                    <span className="text-xs font-bold text-business-primary/40 uppercase tracking-tighter">ID: #89234 • Ajouté hier</span>
                </div>
            </div>
            <div className="flex gap-2">
                <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold uppercase">Chaud 🔥</span>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase tracking-tight">Ready to Buy</span>
            </div>
        </div>
        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
                <div>
                    <p className="text-[10px] font-bold text-business-primary/40 uppercase mb-2">Infos Contact</p>
                    <div className="space-y-2 text-sm font-semibold">
                        <div className="flex items-center gap-2"><Mail className="size-4 opacity-50" /> jp.morel@gmail.com</div>
                        <div className="flex items-center gap-2"><Phone className="size-4 opacity-50" /> +33 6 12 34 56 78</div>
                        <div className="flex items-center gap-2"><ArrowUp className="size-4 opacity-50" /> Source: <span className="text-emerald-600">Ads Instagram</span></div>
                    </div>
                </div>
                <div>
                    <p className="text-[10px] font-bold text-business-primary/40 uppercase mb-2">Historique d'Interaction</p>
                    <div className="space-y-3">
                        <InteractionItem icon={<MessageSquare className="size-3" />} text='"Je suis intéressé par le programme Mastermind..."' subtext="WhatsApp - 10:45" color="bg-emerald-100 text-emerald-700" italic={true} />
                        <InteractionItem icon={<Phone className="size-3" />} text="Discovery Call complété (12 min)" subtext="Hier - 16:30" color="bg-sky-100 text-sky-700" />
                    </div>
                </div>
            </div>
            <div className="space-y-6">
                <div className="bg-business-primary/5 p-4 rounded-xl border border-business-primary/10">
                    <p className="text-[10px] font-bold text-business-primary/40 uppercase mb-2">Notes & Objections</p>
                    <p className="text-xs leading-relaxed">
                        - Frein principal : Disponibilité immédiate.<br />
                        - OK sur le prix (7,500€).<br />
                        - Proposer l'accès direct aux modules si paiement aujourd'hui.
                    </p>
                </div>
                <div className="p-4 border-t border-business-primary/5">
                    <p className="text-[10px] font-bold text-business-primary/40 uppercase mb-3">Offre Présentée</p>
                    <div className="flex items-center justify-between">
                        <span className="font-bold text-sm">Accompagnement VIP</span>
                        <span className="font-extrabold text-business-primary">7,500€</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

const InteractionItem = ({ icon, text, subtext, color, italic }: any) => (
    <div className="flex gap-3 items-start">
        <div className={`w-6 h-6 rounded-full ${color} flex items-center justify-center`}>{icon}</div>
        <div>
            <div className={`text-xs font-medium ${italic ? 'italic opacity-70' : 'opacity-70'}`}>{text}</div>
            <div className="font-bold text-[10px] mt-1">{subtext}</div>
        </div>
    </div>
);
