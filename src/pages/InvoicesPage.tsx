import { FileText, Plus } from 'lucide-react'

export function InvoicesPage() {
    return (
        <div className="min-h-screen bg-slate-950 p-8 text-slate-200">
            <div className="mx-auto max-w-6xl space-y-8">

                {/* EN-TÊTE */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <FileText className="h-8 w-8 text-blue-500" /> Factures & Devis
                        </h1>
                        <p className="mt-2 text-slate-400">
                            Pilotez votre facturation et suivez vos paiements.
                        </p>
                    </div>
                    <button disabled className="bg-blue-600/50 text-white/50 px-4 py-2 rounded-lg flex items-center gap-2 cursor-not-allowed">
                        <Plus className="h-4 w-4" /> Nouvelle Facture
                    </button>
                </div>

                {/* CONTENU VIDE */}
                <div className="rounded-xl bg-slate-900 border border-slate-800 p-12 text-center animate-in fade-in zoom-in duration-500">
                    <div className="bg-slate-800/50 p-4 rounded-full inline-block mb-4">
                        <FileText className="h-12 w-12 text-slate-600" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Module en construction 🚧</h3>
                    <p className="text-slate-400 max-w-md mx-auto">
                        La gestion des factures arrive très bientôt sur CloseOS.
                        Vous pourrez éditer des devis, facturer vos clients et suivre vos encaissements.
                    </p>
                </div>

            </div>
        </div>
    )
}
