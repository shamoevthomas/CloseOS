
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Phone,
    Calendar,
    Clock,
    Search,
    Filter,
    CheckCircle2,
    XCircle,
    MoreHorizontal,
    FileText,
    User,
    Sparkles
} from 'lucide-react'
import { useCalls, type CallLog } from '../contexts/CallsContext'
import { useProspects } from '../contexts/ProspectsContext'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export function CallsPage() {
    const navigate = useNavigate()
    const { callHistory, loading } = useCalls()
    const { prospects } = useProspects()
    const [searchTerm, setSearchTerm] = useState('')
    const [filterType, setFilterType] = useState<'all' | 'missed' | 'answered'>('all')

    const filteredCalls = callHistory.filter(call => {
        const matchesSearch = call.contactName.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesFilter =
            filterType === 'all' ? true :
                filterType === 'missed' ? !call.answered :
                    call.answered

        return matchesSearch && matchesFilter
    })

    const getProspectDetails = (contactId: number) => {
        return prospects.find(p => p.id === contactId)
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
            <div className="mx-auto max-w-7xl space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Appels</h1>
                        <p className="mt-2 text-slate-500 dark:text-slate-400">
                            Historique et détails de vos communications téléphoniques
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-sm">
                            <Filter className="h-4 w-4" />
                            Filtres
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-500/20 transition-all">
                            <Phone className="h-4 w-4" />
                            Nouvel appel
                        </button>
                    </div>
                </div>

                {/* Filters & Stats */}
                <div className="grid gap-6 md:grid-cols-4">
                    <div className="md:col-span-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Rechercher un contact..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setFilterType('all')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === 'all' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-gray-100 text-slate-500 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'}`}
                            >
                                Tous
                            </button>
                            <button
                                onClick={() => setFilterType('answered')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === 'answered' ? 'bg-emerald-500 text-white' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'}`}
                            >
                                Aboutis
                            </button>
                            <button
                                onClick={() => setFilterType('missed')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === 'missed' ? 'bg-red-500 text-white' : 'bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20'}`}
                            >
                                Manqués
                            </button>
                        </div>
                    </div>
                </div>

                {/* Calls List */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50">
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Contact</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date & Heure</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Durée</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Statut</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                            Chargement de l'historique...
                                        </td>
                                    </tr>
                                ) : filteredCalls.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-medium italic">
                                            Aucun appel trouvé.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredCalls.map((call) => (
                                        <tr
                                            key={call.id}
                                            onClick={() => navigate(`/appels/${call.id}`)}
                                            className="group cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${call.isAi ? 'from-purple-500 to-indigo-600' : 'from-blue-500 to-cyan-600'} text-white font-bold shadow-md`}>
                                                        {call.contactName.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                            {call.contactName}
                                                        </p>
                                                        <div className="flex items-center gap-2">
                                                            {call.contactType === 'prospect' && (
                                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                                    Prospect
                                                                </span>
                                                            )}
                                                            {call.isAi && (
                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20">
                                                                    <Sparkles className="h-3 w-3" /> IA
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-slate-900 dark:text-slate-200">
                                                        {format(new Date(call.date), 'dd MMM yyyy', { locale: fr })}
                                                    </span>
                                                    <span className="text-xs text-slate-500 flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        {format(new Date(call.date), 'HH:mm', { locale: fr })}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-mono text-sm font-medium text-slate-700 dark:text-slate-300">
                                                    {call.duration}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${call.answered
                                                    ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                                                    : 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20'
                                                    }`}>
                                                    {call.answered ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                                                    {call.answered ? 'Abouti' : 'Manqué'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                                    <MoreHorizontal className="h-5 w-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
