import React, { Component } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, Trash2, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

export class AgendaErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 Agenda crashed:', error, errorInfo)
    this.setState({
      error,
      errorInfo
    })
  }

  handleReset = () => {
    if (confirm('⚠️ Ceci supprimera tous les événements pour réparer l\'agenda. Continuer?')) {
      console.log('🧹 Emergency reset: clearing closeros_events')
      localStorage.removeItem('closeros_events')
      window.location.reload()
    }
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-gray-950 p-8">
          <div className="w-full max-w-2xl rounded-2xl border border-red-900/50 bg-gray-900 p-8 shadow-2xl">
            {/* Icon */}
            <div className="mb-6 flex justify-center">
              <div className="rounded-full bg-red-500/20 p-4">
                <AlertTriangle size={48} className="text-red-500" />
              </div>
            </div>

            {/* Title */}
            <h1 className="mb-2 text-center text-3xl font-bold text-white">
              Mode de Récupération
            </h1>

            {/* Description */}
            <p className="mb-8 text-center text-gray-400">
              L'agenda a rencontré une erreur et ne peut pas s'afficher. Utilisez les options ci-dessous pour réparer le problème.
            </p>

            {/* Error Details (Collapsible) */}
            <details className="mb-8 rounded-lg border border-gray-800 bg-gray-800/50 p-4">
              <summary className="cursor-pointer font-semibold text-gray-300">
                Détails techniques de l'erreur
              </summary>
              <div className="mt-4 space-y-2">
                <div className="rounded bg-gray-950 p-3">
                  <p className="text-xs text-red-400">
                    <strong>Erreur:</strong> {this.state.error?.toString()}
                  </p>
                </div>
                {this.state.errorInfo && (
                  <div className="max-h-40 overflow-y-auto rounded bg-gray-950 p-3">
                    <p className="whitespace-pre-wrap text-xs text-gray-500">
                      {this.state.errorInfo.componentStack}
                    </p>
                  </div>
                )}
              </div>
            </details>

            {/* Action Buttons */}
            <div className="space-y-3">
              {/* Option 1: Just Reload */}
              <button
                onClick={this.handleReload}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-blue-600 px-6 py-4 font-bold text-white transition-all hover:bg-blue-700"
              >
                <RefreshCw size={20} />
                Recharger la page
              </button>

              {/* Option 2: Emergency Reset */}
              <button
                onClick={this.handleReset}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-red-700 bg-red-600 px-6 py-4 font-bold text-white transition-all hover:bg-red-700"
              >
                <Trash2 size={20} />
                Purger les données et réparer
              </button>
            </div>

            {/* Warning */}
            <div className="mt-6 rounded-lg border border-yellow-900/50 bg-yellow-500/10 p-4">
              <p className="text-center text-xs text-yellow-400">
                <strong>⚠️ Attention:</strong> L'option "Purger" supprimera tous vos événements mais
                réparera l'agenda.
              </p>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
