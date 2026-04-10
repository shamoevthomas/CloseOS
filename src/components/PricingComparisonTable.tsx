import { CheckCircle2 } from 'lucide-react';

export function PricingComparisonTable({ isModal = false }: { isModal?: boolean }) {
    const features = [
        {
            category: "Fondations",
            items: [
                { name: "CRM & Pipeline Visuel", description: "Connecté à votre CRM actuel (HubSpot, Pipedrive, Iclosed)" },
                { name: "Agenda & Booking", description: "Liens de booking, synchronisation Google Calendar & Prise de RDV" },
                { name: "Facturation & Envoi Automatique", description: "Générateur PDF automatique, envoi auto & Suivi des paiements" },
                { name: "KPIs Avancés", description: "CA Généré, Ventes, Taux de Conversion, Évolution, Objectifs" }
            ]
        },
        {
            category: "Performance & Scaling",
            items: [
                { name: "Rappels programmables", description: "Programmez des rappels sur vos appels et prospects" },
                { name: "Call Room (Scripts & Notes)", description: "Scripts interactifs à l'écran & Prise de note liée au contact" },
                { name: "Enregistrement d'appels", description: "Replay vidéo/audio des sessions pour s'auto-analyser" },
                { name: "Automatisations", description: "Factures auto, Mise à jour des KPI, Sync CRM native" },
                { name: "Rapport de performance", description: "Rapport ultra-précis sur vos points de blocage et axes d'amélioration (Prochainement)" }
            ]
        },
        {
            category: "Service",
            items: [
                { name: "Support Client Prioritaire", description: "Assistance technique prioritaire et aide à la configuration" }
            ]
        }
    ];

    if (isModal) {
        return (
            <div className="bg-[#111111] p-6 rounded-2xl">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-white mb-2">Pack Pro — Tout inclus</h2>
                    <p className="text-white/40 text-sm">Toutes les fonctionnalités incluses dans votre abonnement.</p>
                </div>
                <div className="space-y-6">
                    {features.map((section, sIdx) => (
                        <div key={sIdx}>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-3">{section.category}</p>
                            <div className="space-y-2">
                                {section.items.map((feature, fIdx) => (
                                    <div key={fIdx} className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                                        <div>
                                            <div className="font-semibold text-white/80 text-sm">{feature.name}</div>
                                            <div className="text-xs text-white/40 mt-0.5">{feature.description}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <section className="py-20 bg-[#111111] border-t border-white/[0.08]">
            <div className="max-w-3xl mx-auto px-6">
                <div className="text-center mb-16">
                    <h2 className="text-3xl font-bold text-white mb-4">Pack Pro — Tout inclus</h2>
                    <p className="text-white/40">Toutes les fonctionnalités incluses dans votre abonnement.</p>
                </div>

                <div className="space-y-8">
                    {features.map((section, sIdx) => (
                        <div key={sIdx}>
                            <p className="text-xs font-bold uppercase tracking-wider text-white/40 mb-4">{section.category}</p>
                            <div className="space-y-3">
                                {section.items.map((feature, fIdx) => (
                                    <div key={fIdx} className="flex items-start gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors">
                                        <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
                                        <div>
                                            <div className="font-semibold text-white/80">{feature.name}</div>
                                            <div className="text-sm text-white/40 mt-0.5">{feature.description}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
