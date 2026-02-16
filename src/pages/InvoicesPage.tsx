import { useState } from 'react'
import { FileText, Download, Filter, Search, Plus, MoreHorizontal } from 'lucide-react'

export function InvoicesPage() {
    const [invoices] = useState([
        { id: 'INV-001', client: 'Acme Corp', date: '2023-10-15', amount: '1,200.00 €', status: 'Payée' },
        { id: 'INV-002', client: 'Globex Inc', date: '2023-10-20', amount: '850.50 €', status: 'En attente' },
        { id: 'INV-003', client: 'Soylent Corp', date: '2023-10-22', amount: '2,300.00 €', status: 'En retard' },
    ])

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 font-sans text-slate-900 dark:text-slate-100">
            <div className="mx-auto max-w-7xl space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Factures</h1>
                        <p className="mt-1 text-slate-500 dark:text-slate-400">
                            Gérez vos factures et suivez vos paiements.
                        </p>
                    </div>
                    <button className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-blue-500 shadow-lg shadow-blue-600/20 active:scale-95">
                        <Plus className="h-5 w-5" />
                        Nouvelle Facture
                    </button>
                </div>

                {/* Filters & Search */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Rechercher une facture..."
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-3 pl-10 pr-4 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-all"
                        />
                    </div>
                    <button className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        <Filter className="h-4 w-4" />
                        Filtrer
                    </button>
                </div>

                {/* Invoices List */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase font-bold text-xs tracking-wider border-b border-slate-200 dark:border-slate-800">
                                <tr>
                                    <th className="px-6 py-4">Numéro</th>
                                    <th className="px-6 py-4">Client</th>
                                    <th className="px-6 py-4">Date</th>
                                    <th className="px-6 py-4">Montant</th>
                                    <th className="px-6 py-4">Statut</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {invoices.map((invoice) => (
                                    <tr key={invoice.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white flex items-center gap-2">
                                            <FileText className="h-4 w-4 text-blue-500" />
                                            {invoice.id}
                                        </td>
                                        <td className="px-6 py-4 text-slate-700 dark:text-slate-300">{invoice.client}</td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{invoice.date}</td>
                                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{invoice.amount}</td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide border ${invoice.status === 'Payée'
                                                    ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                                                    : invoice.status === 'En retard'
                                                        ? 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20'
                                                        : 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20'
                                                }`}>
                                                {invoice.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                                    <Download className="h-4 w-4" />
                                                </button>
                                                <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {invoices.length === 0 && (
                        <div className="p-12 text-center text-slate-500 dark:text-slate-400 italic">
                            Aucune facture trouvée.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
