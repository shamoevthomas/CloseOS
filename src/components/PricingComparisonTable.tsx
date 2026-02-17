import { CheckCircle2, XCircle } from 'lucide-react';

export function PricingComparisonTable({ isModal = false }: { isModal?: boolean }) {
    const features = [
        {
            category: "Fondations",
            items: [
                {
                    name: "CRM & Pipeline Visuel",
                    description: "Connecté à votre CRM actuel (HubSpot, Pipedrive, Iclosed)",
                    starter: true,
                    founder: true
                },
                {
                    name: "Agenda & Booking",
                    description: "Liens de booking, synchronisation Google Calendar & Prise de RDV",
                    starter: true,
                    founder: true
                },
                {
                    name: "Facturation",
                    description: "Générateur PDF automatique & Suivi des paiements",
                    starter: true,
                    founder: true
                },
                {
                    name: "KPIs",
                    description: "CA Généré, Ventes Totales, Taux de Conversion, Mes Commissions, No Show, Deals Perdus",
                    starter: true,
                    founder: true
                }
            ]
        },
        {
            category: "Performance & Scaling",
            items: [
                {
                    name: "Envoi automatique des factures",
                    description: "Email automatique à l'infopreneur/agence",
                    starter: false,
                    founder: true
                },
                {
                    name: "Evolution",
                    description: "Graphiques d'évolution, Filtres par offre, Calculateur d'objectifs",
                    starter: false,
                    founder: true
                },
                {
                    name: "Call Room (Scripts & Notes)",
                    description: "Scripts interactifs à l'écran & Prise de note liée au contact",
                    starter: false,
                    founder: true
                },
                {
                    name: "Enregistrement d'appels",
                    description: "Replay vidéo/audio des sessions pour s'auto-analyser",
                    starter: false,
                    founder: true
                },
                {
                    name: "Automatisations",
                    description: "Factures auto, Mise à jour des KPI, Sync CRM native",
                    starter: false,
                    founder: true
                },
                {
                    name: "Rapport de performance",
                    description: "Rapport ultra-précis sur vos points de blocage et axes d'amélioration (Prochainement)",
                    starter: false,
                    founder: true
                }
            ]
        },
        {
            category: "Service",
            items: [
                {
                    name: "Support Client",
                    description: "Assistance technique et aide à la configuration",
                    starter: "Email standard",
                    founder: "Prioritaire 24/7"
                }
            ]
        }
    ];

    if (isModal) {
        return (
            <div className="bg-slate-950 p-6 rounded-2xl">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-white mb-2">Comparatif Détaillé</h2>
                    <p className="text-slate-400 text-sm">Tout ce qui est inclus dans chaque offre.</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr>
                                <th className="p-3 w-1/2"></th>
                                <th className="p-3 text-center">
                                    <span className="block text-lg font-bold text-white mb-1">Starter</span>
                                </th>
                                <th className="p-3 text-center ">
                                    <span className="block text-lg font-bold text-blue-400 mb-1">Founder</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 border-t border-slate-800">
                            {features.map((section, sIdx) => (
                                <>
                                    <tr key={`section-${sIdx}`} className="bg-slate-900/30">
                                        <td colSpan={3} className="py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                            {section.category}
                                        </td>
                                    </tr>
                                    {section.items.map((feature, fIdx) => (
                                        <tr key={`feat-${sIdx}-${fIdx}`} className="hover:bg-slate-900/20 transition-colors">
                                            <td className="p-3">
                                                <div className="font-semibold text-slate-200 text-sm">{feature.name}</div>
                                                <div className="text-xs text-slate-500 mt-0.5">{feature.description}</div>
                                            </td>
                                            <td className="p-3 text-center align-middle">
                                                {renderValue(feature.starter)}
                                            </td>
                                            <td className="p-3 text-center align-middle bg-blue-500/5">
                                                {renderValue(feature.founder, true)}
                                            </td>
                                        </tr>
                                    ))}
                                </>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )
    }

    return (
        <section className="py-20 bg-slate-950 border-t border-slate-900">
            <div className="max-w-5xl mx-auto px-6">
                <div className="text-center mb-16">

                    <h2 className="text-3xl font-bold text-white mb-4">Comparatif Détaillé</h2>
                    <p className="text-slate-400">Tout ce qui est inclus dans chaque offre.</p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr>
                                <th className="p-4 w-1/2"></th>
                                <th className="p-4 text-center">
                                    <span className="block text-xl font-bold text-white mb-1">Starter</span>
                                    <span className="block text-sm text-slate-500">L'Essentiel</span>
                                </th>
                                <th className="p-4 text-center ">
                                    <div className="relative inline-block">
                                        <span className="block text-xl font-bold text-blue-400 mb-1">Founder</span>
                                        <span className="block text-sm text-blue-500/80">L'Expérience Ultime</span>
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 border-t border-slate-800">
                            {features.map((section, sIdx) => (
                                <>
                                    <tr key={`section-${sIdx}`} className="bg-slate-900/30">
                                        <td colSpan={3} className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                                            {section.category}
                                        </td>
                                    </tr>
                                    {section.items.map((feature, fIdx) => (
                                        <tr key={`feat-${sIdx}-${fIdx}`} className="hover:bg-slate-900/20 transition-colors">
                                            <td className="p-4">
                                                <div className="font-semibold text-slate-200">{feature.name}</div>
                                                <div className="text-sm text-slate-500 mt-0.5">{feature.description}</div>
                                            </td>
                                            <td className="p-4 text-center align-middle">
                                                {renderValue(feature.starter)}
                                            </td>
                                            <td className="p-4 text-center align-middle bg-blue-500/5">
                                                {renderValue(feature.founder, true)}
                                            </td>
                                        </tr>
                                    ))}
                                </>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}

function renderValue(value: boolean | string, isPremium = false) {
    if (typeof value === 'boolean') {
        return value ? (
            <CheckCircle2 className={`w-6 h-6 mx-auto ${isPremium ? 'text-blue-500' : 'text-slate-400'}`} />
        ) : (
            <XCircle className="w-6 h-6 mx-auto text-slate-700" />
        );
    }
    return <span className={`text-sm font-medium ${isPremium ? 'text-white' : 'text-slate-400'}`}>{value}</span>;
}
