import { useBusinessAuth } from '../contexts/BusinessAuthContext';
import { LayoutDashboard, Users, GitBranch, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export function BusinessDashboard() {
  const { businessProfile, businessSettings } = useBusinessAuth();

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Welcome section */}
      <div className="rounded-2xl border border-amber-200 bg-white p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Bonjour, {businessProfile?.full_name || 'Manager'} !
        </h1>
        <p className="text-slate-500">
          {businessSettings?.company_name
            ? `Bienvenue sur l'espace Business de ${businessSettings.company_name}`
            : "Bienvenue sur votre espace Business CloseOS"
          }
        </p>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/business/crm"
          className="group rounded-2xl border border-amber-200 bg-white p-6 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-100 transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-xl bg-amber-50">
              <GitBranch className="h-6 w-6 text-amber-600" />
            </div>
            <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-amber-500 transition-colors" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">CRM</h3>
          <p className="text-sm text-slate-500">Gérez vos prospects et votre pipeline</p>
        </Link>

        <Link
          to="/business/team"
          className="group rounded-2xl border border-amber-200 bg-white p-6 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-100 transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-xl bg-amber-50">
              <Users className="h-6 w-6 text-amber-600" />
            </div>
            <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-amber-500 transition-colors" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">Équipe</h3>
          <p className="text-sm text-slate-500">Gérez votre équipe et les invitations</p>
        </Link>

        <div className="rounded-2xl border border-amber-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-xl bg-amber-50">
              <LayoutDashboard className="h-6 w-6 text-amber-600" />
            </div>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">Stats</h3>
          <p className="text-sm text-slate-500">Bientôt disponible</p>
        </div>
      </div>
    </div>
  );
}
