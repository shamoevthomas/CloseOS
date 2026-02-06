import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle, Zap, Target, TrendingUp } from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();

  const features = [
    {
      icon: Target,
      title: 'Pipeline Visuel',
      description: 'Gérez vos prospects avec un pipeline Kanban intuitif'
    },
    {
      icon: Zap,
      title: 'Appels Intelligents',
      description: 'Enregistrement automatique et analyse IA de vos calls'
    },
    {
      icon: TrendingUp,
      title: 'Analytics Avancés',
      description: 'Suivez vos KPIs et optimisez votre closing'
    }
  ];

  const benefits = [
    'Scripts de vente personnalisables',
    'Gestion complète des prospects',
    'Enregistrement et analyse des appels',
    'Calendrier intégré pour vos RDV',
    'Tableaux de bord KPI en temps réel',
    'Facturation automatisée'
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">
                <span className="text-blue-500">Closer</span>
                <span className="text-white">OS</span>
              </h1>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="rounded-lg px-6 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
            >
              Se connecter
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-4 py-2 text-sm font-medium text-orange-500 ring-1 ring-orange-500/20">
            <Zap className="h-4 w-4" />
            La solution tout-en-un pour closers d'élite
          </div>

          {/* Main Title */}
          <h1 className="mb-6 text-5xl font-bold leading-tight md:text-6xl">
            CloserOS : La Révolution du{' '}
            <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
              Closing High-Ticket
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mb-10 text-xl text-gray-400 md:text-2xl">
            Gérez vos prospects, vos scripts et vos appels en un seul endroit.
            <br />
            L'outil tout-en-un pour les closers d'élite.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              onClick={() => navigate('/register')}
              className="flex items-center gap-2 rounded-xl bg-orange-500 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-orange-500/25 transition-all hover:bg-orange-600 hover:scale-105"
            >
              🚀 Commencer Gratuitement
              <ArrowRight className="h-5 w-5" />
            </button>
            <button
              onClick={() => navigate('/login')}
              className="rounded-xl border-2 border-gray-700 px-8 py-4 text-lg font-semibold text-white transition-all hover:border-gray-600 hover:bg-gray-800"
            >
              Se connecter
            </button>
          </div>

          {/* Integrations Section */}
          <div className="mt-20 flex flex-wrap items-center justify-center gap-x-12 gap-y-6 opacity-30 grayscale transition-all hover:opacity-100 hover:grayscale-0">
             <span className="text-lg font-bold">Cal.com</span>
             <span className="text-lg font-bold">Calendly</span>
             <span className="text-lg font-bold">Hubspot</span>
             <span className="text-lg font-bold">Pipedrive</span>
             <ArrowRight className="h-5 w-5 text-orange-500 cursor-pointer hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="border-t border-gray-800 bg-gray-900/50 py-20">
        <div className="container mx-auto px-6">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">
              Tout ce dont vous avez besoin pour closer
            </h2>
            <p className="text-xl text-gray-400">
              Une plateforme complète pour gérer votre activité de closing
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {features.map((feature, index) => (
              <div
                key={index}
                className="rounded-2xl border border-gray-800 bg-gray-900 p-8 transition-all hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/10"
              >
                <div className="mb-4 inline-flex rounded-xl bg-orange-500/10 p-3">
                  <feature.icon className="h-8 w-8 text-orange-500" />
                </div>
                <h3 className="mb-3 text-xl font-bold">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="mx-auto max-w-3xl">
            <div className="mb-12 text-center">
              <h2 className="mb-4 text-3xl font-bold md:text-4xl">
                Fonctionnalités incluses
              </h2>
              <p className="text-xl text-gray-400">
                Tout ce qu'il faut pour maximiser vos conversions
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {benefits.map((benefit, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 rounded-lg bg-gray-900/50 p-4 transition-colors hover:bg-gray-900"
                >
                  <CheckCircle className="h-6 w-6 flex-shrink-0 text-green-500" />
                  <span className="text-gray-300">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-gray-800 bg-gray-900/50 py-20">
        <div className="container mx-auto px-6 text-center">
          <h2 className="mb-6 text-3xl font-bold md:text-4xl">
            Prêt à booster vos performances ?
          </h2>
          <p className="mb-8 text-xl text-gray-400">
            Rejoignez les closers qui utilisent CloserOS pour closer plus, plus vite.
          </p>
          <button
            onClick={() => navigate('/register')}
            className="rounded-xl bg-orange-500 px-10 py-5 text-xl font-bold text-white shadow-lg shadow-orange-500/25 transition-all hover:bg-orange-600 hover:scale-105"
          >
            Démarrer maintenant - C'est gratuit
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8">
        <div className="container mx-auto px-6 text-center text-gray-500">
          <p>&copy; 2024 CloserOS. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}