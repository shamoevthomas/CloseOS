import { useCalls } from '../contexts/CallsContext'
import { Link } from 'react-router-dom'
import { Phone, Calendar, Clock, CheckCircle2, XCircle, User, ArrowRight } from 'lucide-react'
import { MaskedText } from '../components/MaskedText'
import { cn } from '../lib/utils'

export function CallsPage() {
    const { callHistory, loading } = useCalls()

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-400">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-950 p-8 text-slate-200">
            <div className="mx-auto max-w-6xl space-y-8">

                {/* EN-TÊTE */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <Phone className="h-8 w-8 text-blue-500" /> Historique des Appels
                        </h1>
                        <p className="mt-2 text-slate-400">
                            Retrouvez l'historique complet de vos appels passés via CloseOS.
                        </p>
                    </div>
                    <div className="text-right">
                        <span className="text-2xl font-bold text-white">{callHistory.length}</span>
                        <span className="block text-xs uppercase tracking-wider text-slate-500">Appels Total</span>
                    </div>
                </div>

                {/* LISTE DES APPELS */}
                <div className="space-y-4">
                    {callHistory.length === 0 ? (
                        <div className="rounded-xl bg-slate-900 border border-slate-800 p-12 text-center">
                            <Phone className="h-12 w-12 text-slate-700 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-white mb-2">Aucun appel enregistré</h3>
                            <p className="text-slate-400">Vos appels apparaîtront ici une fois que vous aurez commencé à prospecter.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {callHistory.map((call) => (
                                <Link
                                    key={call.id}
                                    to={`/appels/${call.id}`}
                                    className="group block rounded-xl bg-slate-900 border border-slate-800 p-6 hover:border-blue-500/50 hover:bg-slate-900/80 transition-all duration-200"
                                >
                                    <div className="flex items-center justify-between">

                                        {/* INFO CONTACT */}
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold shadow-lg",
                                                call.isAi ? "bg-purple-500/20 text-purple-400" : "bg-blue-500/20 text-blue-400"
                                            )}>
                                                {call.contactName.charAt(0)}
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors flex items-center gap-2">
                                                    <MaskedText value={call.contactName} type="name" />
                                                    {call.isAi && <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/30">IA</span>}
                                                </h3>
                                                <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
                                                    <span className="flex items-center gap-1.5">
                                                        <Calendar className="h-3.5 w-3.5" />
                                                        {new Date(call.date).toLocaleDateString()}
                                                    </span>
                                                    <span className="flex items-center gap-1.5">
                                                        <Clock className="h-3.5 w-3.5" />
                                                        {new Date(call.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* STATUS & ACTIONS */}
                                        <div className="flex items-center gap-6">
                                            <div className="text-right">
                                                <div className={cn(
                                                    "inline-flex items-center gap-1.5 text-sm font-medium mb-1",
                                                    call.answered ? "text-emerald-400" : "text-red-400"
                                                )}>
                                                    {call.answered ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                                                    {call.answered ? "Abouti" : "Manqué"}
                                                </div>
                                                <div className="text-xs font-mono text-slate-500">
                                                    Durée : {call.duration}
                                                </div>
                                            </div>
                                            <ArrowRight className="h-5 w-5 text-slate-600 group-hover:text-white transition-transform group-hover:translate-x-1" />
                                        </div>

                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    )
}
