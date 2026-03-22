import { useState, useEffect, useCallback } from 'react'
import { Megaphone, Eye, UserCheck, Loader2, TrendingUp } from 'lucide-react'
import {
  PieChart, Pie, Cell,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'

interface CampaignStat {
  id: string
  name: string
  views: number
  is_active: boolean
  totalLeads: number
  wonCount: number
  totalCA: number
  noanswerCount: number
  noshowCount: number
  unqualifiedCount: number
  conversionRate: number
  wonRate: number
}

const API_URL = '/api/business'

const COLORS = ['#d97706', '#2563eb', '#7c3aed', '#059669', '#e11d48', '#0891b2', '#ea580c', '#4f46e5']

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)

export function BusinessAcquisition() {
  const { user, ownerUserId } = useBusinessAuth()
  const effectiveUserId = ownerUserId || user?.id
  const [stats, setStats] = useState<CampaignStat[]>([])
  const [loading, setLoading] = useState(true)
  const [pieView, setPieView] = useState<'views' | 'conversion'>('views')
  const [countAsUneducated, setCountAsUneducated] = useState(false)

  const fetchStats = useCallback(async () => {
    if (!effectiveUserId) return
    try {
      const res = await fetch(`${API_URL}?action=acquisition-stats&user_id=${effectiveUserId}`)
      const data = await res.json()
      if (data.stats) setStats(data.stats)
    } catch (err) {
      console.error('Error fetching acquisition stats:', err)
    } finally {
      setLoading(false)
    }
  }, [effectiveUserId])

  useEffect(() => { fetchStats() }, [fetchStats])

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 text-amber-600 animate-spin" /></div>
  }

  const totalViews = stats.reduce((s, c) => s + c.views, 0)
  const totalLeads = stats.reduce((s, c) => s + c.totalLeads, 0)
  const totalWon = stats.reduce((s, c) => s + c.wonCount, 0)
  const totalCA = stats.reduce((s, c) => s + c.totalCA, 0)
  const globalConversion = totalViews > 0 ? ((totalLeads / totalViews) * 100).toFixed(1) : '0'

  // ─── Pie chart data ───
  const pieData = stats
    .filter(c => pieView === 'views' ? c.views > 0 : c.conversionRate > 0)
    .map(c => ({
      name: c.name,
      value: pieView === 'views' ? c.views : parseFloat(c.conversionRate.toFixed(1)),
    }))
    .sort((a, b) => b.value - a.value)

  // ─── Bar chart: campaigns that generate most "won" leads (%) ───
  const wonBarData = stats
    .filter(c => c.totalLeads > 0)
    .map(c => ({
      name: c.name.length > 15 ? c.name.slice(0, 15) + '…' : c.name,
      fullName: c.name,
      wonRate: parseFloat(c.wonRate.toFixed(1)),
    }))
    .sort((a, b) => b.wonRate - a.wonRate)

  // ─── Full width bar chart: CA per campaign ───
  const caBarData = stats
    .filter(c => c.totalCA > 0)
    .map(c => ({
      name: c.name.length > 20 ? c.name.slice(0, 20) + '…' : c.name,
      fullName: c.name,
      ca: c.totalCA,
    }))
    .sort((a, b) => b.ca - a.ca)

  // ─── Taux d'implication: campaigns with lowest % of noanswer+noshow ───
  const implicationData = stats
    .filter(c => c.totalLeads > 0)
    .map(c => {
      const badCount = c.noanswerCount + c.noshowCount
      const implicationRate = ((1 - badCount / c.totalLeads) * 100)
      return {
        name: c.name.length > 15 ? c.name.slice(0, 15) + '…' : c.name,
        fullName: c.name,
        rate: parseFloat(implicationRate.toFixed(1)),
      }
    })
    .sort((a, b) => b.rate - a.rate)

  // ─── Taux d'éducation: campaigns with lowest % of unqualified (+ optionally noanswer/noshow) ───
  const educationData = stats
    .filter(c => c.totalLeads > 0)
    .map(c => {
      const badCount = c.unqualifiedCount + (countAsUneducated ? c.noanswerCount + c.noshowCount : 0)
      const educationRate = ((1 - badCount / c.totalLeads) * 100)
      return {
        name: c.name.length > 15 ? c.name.slice(0, 15) + '…' : c.name,
        fullName: c.name,
        rate: parseFloat(educationRate.toFixed(1)),
      }
    })
    .sort((a, b) => b.rate - a.rate)

  return (
    <div className="space-y-6">

      {/* ─── Campaign Cards (top) ─── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Global summary cards */}
        <div className="bg-white rounded-xl border border-[#493627]/10 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100">
              <Megaphone className="h-4 w-4 text-amber-700" />
            </div>
            <p className="text-xs font-medium text-slate-500">Campagnes actives</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.filter(c => c.is_active).length}</p>
        </div>
        <div className="bg-white rounded-xl border border-[#493627]/10 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100">
              <Eye className="h-4 w-4 text-blue-700" />
            </div>
            <p className="text-xs font-medium text-slate-500">Vues totales</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{totalViews.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-[#493627]/10 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100">
              <UserCheck className="h-4 w-4 text-purple-700" />
            </div>
            <p className="text-xs font-medium text-slate-500">Taux d'inscription global</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{globalConversion}%</p>
          <p className="text-xs text-slate-400 mt-0.5">{totalLeads} leads / {totalViews} vues</p>
        </div>
        <div className="bg-white rounded-xl border border-[#493627]/10 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100">
              <TrendingUp className="h-4 w-4 text-emerald-700" />
            </div>
            <p className="text-xs font-medium text-slate-500">CA généré</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalCA)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{totalWon} client{totalWon !== 1 ? 's' : ''} gagné{totalWon !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* ─── Per-campaign stat cards ─── */}
      {stats.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {stats.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-[#493627]/10 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-slate-900 truncate flex-1 mr-2">{c.name}</h4>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                  {c.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-blue-600">{c.views}</p>
                  <p className="text-[10px] text-slate-400">Vues</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-purple-600">{c.totalLeads}</p>
                  <p className="text-[10px] text-slate-400">Leads</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-amber-600">{c.conversionRate.toFixed(1)}%</p>
                  <p className="text-[10px] text-slate-400">Conversion</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Charts row: Pie + Won bar ─── */}
      {stats.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: Pie chart */}
          <div className="bg-white rounded-xl border border-[#493627]/10 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#493627]">Répartition par campagne</h3>
              <div className="flex rounded-lg bg-amber-50 p-0.5 border border-amber-200">
                <button
                  onClick={() => setPieView('views')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${pieView === 'views' ? 'bg-amber-600 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Plus ouverte
                </button>
                <button
                  onClick={() => setPieView('conversion')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${pieView === 'conversion' ? 'bg-amber-600 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Plus convertie
                </button>
              </div>
            </div>
            <div className="h-72">
              {pieData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-slate-400">Aucune donnée</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name.length > 12 ? name.slice(0, 12) + '…' : name}: ${value}${pieView === 'conversion' ? '%' : ''}`}
                    >
                      {pieData.map((_, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [pieView === 'views' ? `${value} vues` : `${value}%`, 'Valeur']}
                      contentStyle={{ borderRadius: 12, border: '1px solid #e5d5c3', fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Right: Won rate bar chart */}
          <div className="bg-white rounded-xl border border-[#493627]/10 p-5">
            <h3 className="text-sm font-semibold text-[#493627] mb-4">Taux de conversion en client (%)</h3>
            <p className="text-xs text-slate-400 mb-4">Quelle campagne génère les leads qui achètent le plus ?</p>
            <div className="h-64">
              {wonBarData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-slate-400">Aucune donnée</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={wonBarData} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe4" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#493627' }} unit="%" domain={[0, 100]} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#493627' }} width={110} />
                    <Tooltip
                      formatter={(value: number, _: any, entry: any) => [`${value}%`, entry.payload.fullName]}
                      contentStyle={{ borderRadius: 12, border: '1px solid #e5d5c3', fontSize: 12 }}
                    />
                    <Bar dataKey="wonRate" fill="#059669" radius={[0, 6, 6, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Full width: CA per campaign bar chart ─── */}
      {caBarData.length > 0 && (
        <div className="bg-white rounded-xl border border-[#493627]/10 p-5">
          <h3 className="text-sm font-semibold text-[#493627] mb-1">Chiffre d'affaires par campagne</h3>
          <p className="text-xs text-slate-400 mb-4">Quelle campagne génère le plus de CA ?</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={caBarData} margin={{ left: 10, right: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe4" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#493627' }} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11, fill: '#493627' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k€`} />
                <Tooltip
                  formatter={(value: number, _: any, entry: any) => [formatCurrency(value), entry.payload.fullName]}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5d5c3', fontSize: 12 }}
                />
                <Bar dataKey="ca" fill="#d97706" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ─── Implication + Éducation charts row ─── */}
      {stats.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Taux d'implication */}
          <div className="bg-white rounded-xl border border-[#493627]/10 p-5">
            <h3 className="text-sm font-semibold text-[#493627] mb-1">Taux d'implication (%)</h3>
            <p className="text-xs text-slate-400 mb-4">Campagnes avec le moins de "Pas de réponse" et "No Show"</p>
            <div className="h-64">
              {implicationData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-slate-400">Aucune donnée</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={implicationData} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe4" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#493627' }} unit="%" domain={[0, 100]} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#493627' }} width={110} />
                    <Tooltip
                      formatter={(value: number, _: any, entry: any) => [`${value}%`, entry.payload.fullName]}
                      contentStyle={{ borderRadius: 12, border: '1px solid #e5d5c3', fontSize: 12 }}
                    />
                    <Bar dataKey="rate" fill="#2563eb" radius={[0, 6, 6, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Taux d'éducation */}
          <div className="bg-white rounded-xl border border-[#493627]/10 p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-[#493627]">Taux d'éducation (%)</h3>
            </div>
            <p className="text-xs text-slate-400 mb-3">Campagnes avec le moins de "Non qualifié"</p>
            <label className="flex items-center gap-2 mb-4 cursor-pointer select-none">
              <button
                onClick={() => setCountAsUneducated(!countAsUneducated)}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${countAsUneducated ? 'bg-amber-600' : 'bg-slate-200'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${countAsUneducated ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
              </button>
              <span className="text-xs text-slate-500">Compter les "Pas de réponse" et "No Show" comme non éduqués</span>
            </label>
            <div className="h-56">
              {educationData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-slate-400">Aucune donnée</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={educationData} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe4" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#493627' }} unit="%" domain={[0, 100]} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#493627' }} width={110} />
                    <Tooltip
                      formatter={(value: number, _: any, entry: any) => [`${value}%`, entry.payload.fullName]}
                      contentStyle={{ borderRadius: 12, border: '1px solid #e5d5c3', fontSize: 12 }}
                    />
                    <Bar dataKey="rate" fill="#7c3aed" radius={[0, 6, 6, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {stats.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/50 py-16">
          <Megaphone className="h-12 w-12 text-amber-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">Aucune donnée d'acquisition</h3>
          <p className="text-sm text-slate-500">Créez des campagnes et partagez vos pages de capture pour voir les statistiques ici.</p>
        </div>
      )}
    </div>
  )
}
