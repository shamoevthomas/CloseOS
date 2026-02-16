import { useCalls } from '../contexts/CallsContext'
import { Phone, Calendar, Clock, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { MaskedText } from '../components/MaskedText'

export function CallsPage() {
    const { callHistory, loading } = useCalls()
    const navigate = useNavigate()

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        )
    }

    return (
        <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <Phone className="h-8 w-8 text-blue-500" />
                    Historique des Appels
                </h1>
                <span className="text-slate-500 dark:text-slate-400">
                    {callHistory.length} appel{callHistory.length > 1 ? 's' : ''}
                </span>
            </div>

            <div className="grid gap-4">
                {callHistory.length === 0 ? (
                    <div className="text-center py-12 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                        <Phone className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                        <p className="text-slate-600 dark:text-slate-400">Aucun historique d'appel pour le moment.</p>
                    </div>
                ) : (
                    callHistory.map((call) => (
                        <div
                            key={call.id}
                            onClick={() => navigate(`/appels/${call.id}`)}
                            className="group flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 hover:shadow-lg transition-all cursor-pointer"
                        >
                            <div className="flex items-center gap-4">
                                <div className={`
                  flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold
                  ${call.isAi ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400' : 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'}
                `}>
                                    {call.contactName.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <MaskedText value={call.contactName} type="name" />
                                        {call.contactType === 'prospect' && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                Prospect
                                            </span>
                                        )}
                                    </h3>
                                    <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 mt-1">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {new Date(call.date).toLocaleDateString()}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {new Date(call.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Phone className="h-3 w-3" />
                                            {call.duration}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className={`
                  px-3 py-1 rounded-full text-xs font-medium border
                  ${call.answered
                                        ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                                        : 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20'}
                `}>
                                    {call.answered ? 'Abouti' : 'Sans réponse'}
                                </div>
                                <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
