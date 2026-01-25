import { Hammer, Clock, ShieldAlert } from 'lucide-react'

export function MaintenancePage() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-black p-4 text-center">
      <div className="relative mb-8">
        <div className="absolute -inset-1 rounded-full bg-purple-500 blur opacity-30 animate-pulse"></div>
        <div className="relative rounded-full bg-slate-900 p-6 border border-slate-800">
          <Hammer className="h-12 w-12 text-purple-500" />
        </div>
      </div>
      <h1 className="text-4xl font-bold text-white mb-4">
        Close<span className="text-purple-500">OS</span> est en maintenance
      </h1>
      <p className="text-lg text-slate-400 max-w-md mb-8">
        Mise à jour majeure en cours suite à vos retours.
      </p>
      <div className="flex gap-4 text-sm text-slate-500 bg-slate-900/50 p-6 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-blue-400" /><span>Retour Lundi</span></div>
        <div className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-emerald-400" /><span>Données sécurisées</span></div>
      </div>
    </div>
  )
}