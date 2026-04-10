import { useState, useEffect, useCallback, useRef } from 'react'
import { CheckSquare, Square, Download, Loader2 } from 'lucide-react'
// @ts-ignore - html2pdf.js doesn't have types
import html2pdf from 'html2pdf.js'
import { useProspects } from '../contexts/ProspectsContext'
import { useOffers } from '../contexts/OffersContext'
import { useAuth } from '../contexts/AuthContext'
import { useCustomStages } from '../hooks/useCustomStages'
import { useTags } from '../hooks/useTags'
import { supabase } from '../lib/supabase'

type ExportSection = 'kpi' | 'pipeline' | 'contacts' | 'factures' | 'rappels'

const SECTIONS: { id: ExportSection; label: string }[] = [
  { id: 'kpi', label: 'KPI (CA, Ventes, Conversion)' },
  { id: 'pipeline', label: 'Pipeline (Prospects par étape)' },
  { id: 'contacts', label: 'Contacts (Nom, Email, Tél)' },
  { id: 'factures', label: 'Factures' },
  { id: 'rappels', label: 'Rappels' },
]

const STAGE_LABELS: Record<string, string> = {
  prospect: 'Prospect',
  qualified: 'Qualifié',
  won: 'Gagné',
  followup: 'Follow Up',
  noshow: 'No Show',
  lost: 'Perdu',
}

const parsePrice = (v: string | undefined): number => {
  if (!v) return 0
  const cleaned = v.toString().replace(/[^\d.,]/g, '').replace(/,/g, '.')
  const parsed = parseFloat(cleaned.replace(/\s/g, ''))
  return isNaN(parsed) ? 0 : parsed
}

interface Invoice {
  id: number
  invoice_number: string
  amount_ttc: number
  created_at: string
  status: string
}

interface Reminder {
  id: number
  title: string
  due_date: string
  done: boolean
}

export function DataExportContent() {
  const { prospects } = useProspects()
  const { offers } = useOffers()
  const { user, profile } = useAuth()
  const { allStages } = useCustomStages()
  const { getProspectTagObjects } = useTags()
  const pdfRef = useRef<HTMLDivElement>(null)

  const [selected, setSelected] = useState<Set<ExportSection>>(new Set(SECTIONS.map(s => s.id)))
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [generating, setGenerating] = useState(false)
  const [readyToExport, setReadyToExport] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('invoices').select('*').eq('user_id', user.id).then(({ data }) => {
      if (data) setInvoices(data)
    })
    supabase.from('reminders').select('*').eq('user_id', user.id).then(({ data }) => {
      if (data) setReminders(data)
    })
  }, [user])

  const toggleSection = (id: ExportSection) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === SECTIONS.length) setSelected(new Set())
    else setSelected(new Set(SECTIONS.map(s => s.id)))
  }

  // KPI calculations
  const won = prospects.filter(p => p.stage === 'won')
  const totalCA = won.reduce((sum, p) => sum + (p.value || 0), 0)
  const totalVentes = won.length
  const totalProspects = prospects.length
  const tauxConversion = totalProspects > 0 ? ((totalVentes / totalProspects) * 100).toFixed(1) : '0'
  const totalCommissions = won.reduce((sum, p) => {
    const offer = offers.find(o => o.id === (p.offer_id || p.offerId))
    if (!offer) return sum
    return sum + (p.value || 0) * (parsePrice(offer.commission) / 100)
  }, 0)

  const userName = profile?.full_name || 'Utilisateur'
  const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  const stages = allStages.map(s => s.id)
  const now = new Date()

  // When readyToExport is set, wait for render then capture PDF
  useEffect(() => {
    if (!readyToExport || !pdfRef.current) return

    const timer = setTimeout(async () => {
      try {
        const element = pdfRef.current
        if (!element) return

        const opt = {
          margin: [10, 10, 10, 10],
          filename: `CloseOS-Export-${new Date().toISOString().slice(0, 10)}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            windowWidth: 800,
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
        }

        await html2pdf().set(opt).from(element).save()
      } catch (err) {
        console.error('PDF export error:', err)
      } finally {
        setReadyToExport(false)
        setGenerating(false)
      }
    }, 500) // give browser time to paint

    return () => clearTimeout(timer)
  }, [readyToExport])

  const generatePDF = useCallback(() => {
    if (selected.size === 0) return
    setGenerating(true)
    setReadyToExport(true)
  }, [selected])

  const thStyle: React.CSSProperties = {
    padding: '10px 14px',
    textAlign: 'left' as const,
    fontSize: '12px',
    fontWeight: 700,
    color: '#334155',
    borderBottom: '2px solid #e2e8f0',
    background: '#f1f5f9',
  }

  const tdStyle: React.CSSProperties = {
    padding: '10px 14px',
    fontSize: '12px',
    color: '#1e293b',
    borderBottom: '1px solid #f1f5f9',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/40">Sélectionnez les données à exporter :</p>
        <button
          onClick={toggleAll}
          className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          {selected.size === SECTIONS.length ? 'Tout désélectionner' : 'Tout sélectionner'}
        </button>
      </div>

      <div className="space-y-2">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => toggleSection(s.id)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 transition-all text-left"
          >
            {selected.has(s.id)
              ? <CheckSquare className="h-5 w-5 text-emerald-400 shrink-0" />
              : <Square className="h-5 w-5 text-white/40 shrink-0" />
            }
            <span className="text-sm font-medium text-white">{s.label}</span>
          </button>
        ))}
      </div>

      <button
        onClick={generatePDF}
        disabled={selected.size === 0 || generating}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold transition-colors shadow-lg shadow-emerald-500/25"
      >
        {generating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
        {generating ? 'Génération en cours…' : 'Exporter en PDF'}
      </button>

      {/* Hidden PDF content - rendered in DOM for html2canvas to capture */}
      {readyToExport && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '800px', zIndex: -1, opacity: 0, pointerEvents: 'none' }}>
          <div
            ref={pdfRef}
            style={{
              fontFamily: 'Inter, Helvetica, Arial, sans-serif',
              background: '#ffffff',
              color: '#000000',
              padding: '40px',
              width: '800px',
              boxSizing: 'border-box',
            }}
          >
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', padding: '28px 32px', borderRadius: '12px', marginBottom: '32px' }}>
              <h1 style={{ color: '#ffffff', fontSize: '22px', fontWeight: 800, margin: '0 0 4px 0' }}>CloseOS — Export de données</h1>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', margin: 0 }}>{userName} • {dateStr}</p>
            </div>

            {/* KPI */}
            {selected.has('kpi') && (
              <div style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', marginBottom: '16px', paddingBottom: '8px', borderBottom: '2px solid #3b82f6' }}>KPI</h2>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Métrique</th>
                      <th style={thStyle}>Valeur</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td style={tdStyle}>CA Total</td><td style={tdStyle}>{totalCA.toLocaleString('fr-FR')} €</td></tr>
                    <tr><td style={tdStyle}>Ventes (Won)</td><td style={tdStyle}>{totalVentes}</td></tr>
                    <tr><td style={tdStyle}>Taux de conversion</td><td style={tdStyle}>{tauxConversion}%</td></tr>
                    <tr><td style={tdStyle}>Commissions estimées</td><td style={tdStyle}>{totalCommissions.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td></tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Pipeline */}
            {selected.has('pipeline') && (
              <div style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', marginBottom: '16px', paddingBottom: '8px', borderBottom: '2px solid #3b82f6' }}>Pipeline</h2>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Contact</th>
                      <th style={thStyle}>Entreprise</th>
                      <th style={thStyle}>Étape</th>
                      <th style={thStyle}>Montant</th>
                      <th style={thStyle}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prospects.filter(p => stages.includes(p.stage)).length > 0
                      ? prospects
                          .filter(p => stages.includes(p.stage))
                          .sort((a, b) => stages.indexOf(a.stage) - stages.indexOf(b.stage))
                          .map((p, i) => (
                            <tr key={i}>
                              <td style={tdStyle}>{p.contact || p.name || '-'}</td>
                              <td style={tdStyle}>{p.company || '-'}</td>
                              <td style={tdStyle}>{allStages.find(s => s.id === p.stage)?.name || STAGE_LABELS[p.stage] || p.stage}</td>
                              <td style={tdStyle}>{p.value ? p.value.toLocaleString('fr-FR') + ' €' : '-'}</td>
                              <td style={tdStyle}>{p.created_at ? new Date(p.created_at).toLocaleDateString('fr-FR') : '-'}</td>
                            </tr>
                          ))
                      : <tr><td style={tdStyle} colSpan={5}>Aucun prospect</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            )}

            {/* Contacts */}
            {selected.has('contacts') && (
              <div style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', marginBottom: '16px', paddingBottom: '8px', borderBottom: '2px solid #3b82f6' }}>Contacts</h2>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Nom</th>
                      <th style={thStyle}>Entreprise</th>
                      <th style={thStyle}>Email</th>
                      <th style={thStyle}>Téléphone</th>
                      <th style={thStyle}>Tags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prospects.length > 0
                      ? prospects.map((p, i) => (
                          <tr key={i}>
                            <td style={tdStyle}>{p.contact || p.name || '-'}</td>
                            <td style={tdStyle}>{p.company || '-'}</td>
                            <td style={tdStyle}>{p.email || '-'}</td>
                            <td style={tdStyle}>{p.phone || '-'}</td>
                            <td style={tdStyle}>{getProspectTagObjects(p.id).map(t => t.name).join(', ') || '-'}</td>
                          </tr>
                        ))
                      : <tr><td style={tdStyle} colSpan={5}>Aucun contact</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            )}

            {/* Factures */}
            {selected.has('factures') && (
              <div style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', marginBottom: '16px', paddingBottom: '8px', borderBottom: '2px solid #3b82f6' }}>Factures</h2>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>N°</th>
                      <th style={thStyle}>Montant</th>
                      <th style={thStyle}>Date</th>
                      <th style={thStyle}>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.length > 0
                      ? invoices.map((inv, i) => (
                          <tr key={i}>
                            <td style={tdStyle}>{inv.invoice_number || '-'}</td>
                            <td style={tdStyle}>{inv.amount_ttc ? inv.amount_ttc.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €' : '-'}</td>
                            <td style={tdStyle}>{inv.created_at ? new Date(inv.created_at).toLocaleDateString('fr-FR') : '-'}</td>
                            <td style={tdStyle}>{inv.status || '-'}</td>
                          </tr>
                        ))
                      : <tr><td style={tdStyle} colSpan={4}>Aucune facture</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            )}

            {/* Rappels */}
            {selected.has('rappels') && (
              <div style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', marginBottom: '16px', paddingBottom: '8px', borderBottom: '2px solid #3b82f6' }}>Rappels</h2>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Titre</th>
                      <th style={thStyle}>Date</th>
                      <th style={thStyle}>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reminders.length > 0
                      ? reminders.map((r, i) => {
                          const due = new Date(r.due_date)
                          const statut = r.done ? 'Fait' : due < now ? 'En retard' : 'À venir'
                          const statutColor = r.done ? '#10b981' : due < now ? '#ef4444' : '#3b82f6'
                          return (
                            <tr key={i}>
                              <td style={tdStyle}>{r.title || '-'}</td>
                              <td style={tdStyle}>{due.toLocaleDateString('fr-FR')}</td>
                              <td style={{ ...tdStyle, color: statutColor, fontWeight: 600 }}>{statut}</td>
                            </tr>
                          )
                        })
                      : <tr><td style={tdStyle} colSpan={3}>Aucun rappel</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer */}
            <div style={{ marginTop: '40px', paddingTop: '16px', borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
              <p style={{ color: '#94a3b8', fontSize: '11px', margin: 0 }}>Généré par CloseOS — closeos.fr</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
