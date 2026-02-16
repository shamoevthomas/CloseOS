
import { FileText } from 'lucide-react'

export function InvoicesPage() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 flex items-center justify-center">
            <div className="text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20 mb-6">
                    <FileText className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Factures</h1>
                <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    Le module de facturation sera bientôt disponible. Vous pourrez gérer vos devis et factures directement ici.
                </p>
            </div>
        </div>
    )
}
