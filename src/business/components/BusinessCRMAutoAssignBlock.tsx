import { useEffect, useMemo, useState } from 'react'
import { Loader2, Save, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { supabase } from '../../lib/supabase'

type Mode = 'round_robin' | 'random' | 'specific_one' | 'specific_many'
type Role = 'closer' | 'setter'

interface ProviderConfig {
  managed_by_crm?: boolean
  enabled?: boolean
  role?: Role
  mode?: Mode
  team_member_ids?: string[]
  rr_index?: number
}

interface TeamMember {
  user_id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  role: string | null
}

interface Props {
  provider: string
  providerLabel: string
}

export function BusinessCRMAutoAssignBlock({ provider, providerLabel }: Props) {
  const { user, businessSettings, updateBusinessSettings } = useBusinessAuth()
  const all = (businessSettings as any)?.crm_auto_assignment || {}
  const initial: ProviderConfig = (all && typeof all === 'object' && all[provider]) || {}

  const [managedAnswer, setManagedAnswer] = useState<'unset' | 'yes' | 'no'>(
    initial.managed_by_crm === true ? 'yes' :
    initial.managed_by_crm === false ? 'no' : 'unset'
  )
  const [enabled, setEnabled] = useState<boolean>(!!initial.enabled)
  const [role, setRole] = useState<Role>(initial.role === 'setter' ? 'setter' : 'closer')
  const [mode, setMode] = useState<Mode>((initial.mode as Mode) || 'round_robin')
  const [selectedIds, setSelectedIds] = useState<string[]>(initial.team_member_ids || [])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loadingTeam, setLoadingTeam] = useState(false)
  const [saving, setSaving] = useState(false)

  // Re-sync local state when businessSettings refreshes from context
  useEffect(() => {
    const cfg: ProviderConfig = (all && typeof all === 'object' && all[provider]) || {}
    setManagedAnswer(cfg.managed_by_crm === true ? 'yes' : cfg.managed_by_crm === false ? 'no' : 'unset')
    setEnabled(!!cfg.enabled)
    setRole(cfg.role === 'setter' ? 'setter' : 'closer')
    setMode((cfg.mode as Mode) || 'round_robin')
    setSelectedIds(cfg.team_member_ids || [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, businessSettings])

  // Load team members (the org's team)
  useEffect(() => {
    if (!user) return
    setLoadingTeam(true)
    supabase
      .from('business_team_members')
      .select('user_id, first_name, last_name, email, role')
      .eq('business_owner_id', user.id)
      .then(({ data }) => {
        setTeam((data || []) as TeamMember[])
        setLoadingTeam(false)
      })
  }, [user])

  // When switching to specific_one, keep at most 1 selection
  useEffect(() => {
    if (mode === 'specific_one' && selectedIds.length > 1) {
      setSelectedIds([selectedIds[0]])
    }
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  const eligibleTeam = useMemo(() => {
    // We allow picking anyone in the team regardless of stored role —
    // the chosen `role` config decides which DB field gets set
    return team
  }, [team])

  const memberLabel = (m: TeamMember) => {
    const name = [m.first_name, m.last_name].filter(Boolean).join(' ')
    return name || m.email || m.user_id.slice(0, 8)
  }

  const toggleMember = (uid: string) => {
    if (mode === 'specific_one') {
      setSelectedIds([uid])
      return
    }
    setSelectedIds(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid])
  }

  const selectAll = () => setSelectedIds(eligibleTeam.map(m => m.user_id))
  const clearAll = () => setSelectedIds([])

  const handleSetManaged = async (val: boolean) => {
    setManagedAnswer(val ? 'yes' : 'no')
    // Persist immediately so the trigger sees it
    const next: ProviderConfig = {
      ...(all[provider] || {}),
      managed_by_crm: val,
    }
    if (val) next.enabled = false
    const merged = { ...all, [provider]: next }
    await updateBusinessSettings({ crm_auto_assignment: merged })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      let mergedSelected = selectedIds
      if (mode === 'specific_one') mergedSelected = selectedIds.slice(0, 1)
      if (enabled && mergedSelected.length === 0) {
        toast.error('Sélectionnez au moins un membre')
        setSaving(false)
        return
      }
      const next: ProviderConfig = {
        managed_by_crm: false,
        enabled,
        role,
        mode,
        team_member_ids: mergedSelected,
        // Preserve existing rr_index when keeping members; reset if list changed
        rr_index: 0,
      }
      const prev: ProviderConfig = all[provider] || {}
      if (
        prev.team_member_ids &&
        Array.isArray(prev.team_member_ids) &&
        prev.team_member_ids.length === mergedSelected.length &&
        prev.team_member_ids.every((id, i) => id === mergedSelected[i])
      ) {
        next.rr_index = prev.rr_index || 0
      }
      const merged = { ...all, [provider]: next }
      await updateBusinessSettings({ crm_auto_assignment: merged })
      toast.success('Assignation automatique enregistrée')
    } catch (err) {
      console.error(err)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full bg-white dark:bg-neutral-800 border border-[#c4c7c7]/30 dark:border-neutral-700 rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-[#006c49]/20 focus:border-[#006c49] text-[#1b1c1b] dark:text-white'

  return (
    <div className="p-8 rounded-2xl bg-[#f5f3f2] dark:bg-neutral-800 border border-[#c4c7c7]/5 dark:border-neutral-700">
      <h4 className="font-bold text-lg mb-2 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
        Assignation automatique
      </h4>
      <p className="text-[#444748] dark:text-neutral-300 text-sm mb-6">
        Est-ce que <strong>{providerLabel}</strong> gère déjà l'assignation automatique des prospects vers vos équipes ?
      </p>

      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => handleSetManaged(true)}
          className={`px-5 py-2.5 rounded-full font-bold text-sm border transition-colors ${
            managedAnswer === 'yes'
              ? 'bg-[#1b1c1b] text-white border-[#1b1c1b]'
              : 'bg-white dark:bg-neutral-900 text-[#1b1c1b] dark:text-white border-[#c4c7c7]/30 hover:bg-[#eae8e7]'
          }`}
        >
          {managedAnswer === 'yes' && <Check className="inline h-4 w-4 mr-1" />} Oui, mon CRM s'en occupe
        </button>
        <button
          onClick={() => handleSetManaged(false)}
          className={`px-5 py-2.5 rounded-full font-bold text-sm border transition-colors ${
            managedAnswer === 'no'
              ? 'bg-[#1b1c1b] text-white border-[#1b1c1b]'
              : 'bg-white dark:bg-neutral-900 text-[#1b1c1b] dark:text-white border-[#c4c7c7]/30 hover:bg-[#eae8e7]'
          }`}
        >
          {managedAnswer === 'no' && <Check className="inline h-4 w-4 mr-1" />} Non, à configurer ici
        </button>
      </div>

      {managedAnswer === 'yes' && (
        <p className="text-[11px] text-[#006c49] font-medium">
          OK, on respecte l'assignation envoyée par {providerLabel}.
        </p>
      )}

      {managedAnswer === 'no' && (
        <div className="space-y-6 border-t border-[#c4c7c7]/10 dark:border-neutral-700 pt-6">
          {/* Switch */}
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <p className="font-bold text-sm text-[#1b1c1b] dark:text-white">Activer l'assignation automatique</p>
              <p className="text-xs text-[#444748]/70 mt-1">À chaque prospect reçu de {providerLabel}, on l'assigne automatiquement.</p>
            </div>
            <span className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <span className="w-11 h-6 bg-[#c4c7c7]/40 peer-checked:bg-[#1b1c1b] rounded-full transition-colors"></span>
              <span className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5"></span>
            </span>
          </label>

          {enabled && (
            <>
              {/* Role */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#444748]/60 uppercase tracking-tighter">Type d'assignation</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setRole('closer')}
                    className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold border transition-colors ${
                      role === 'closer' ? 'bg-[#1b1c1b] text-white border-[#1b1c1b]' : 'bg-white dark:bg-neutral-900 border-[#c4c7c7]/30'
                    }`}
                  >
                    Closer
                  </button>
                  <button
                    onClick={() => setRole('setter')}
                    className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold border transition-colors ${
                      role === 'setter' ? 'bg-[#1b1c1b] text-white border-[#1b1c1b]' : 'bg-white dark:bg-neutral-900 border-[#c4c7c7]/30'
                    }`}
                  >
                    Setter
                  </button>
                </div>
              </div>

              {/* Mode */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#444748]/60 uppercase tracking-tighter">Mode d'assignation</label>
                <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} className={inputCls}>
                  <option value="round_robin">Tournante (round-robin)</option>
                  <option value="random">Au hasard</option>
                  <option value="specific_one">Un membre précis</option>
                  <option value="specific_many">Plusieurs membres précis (tournante)</option>
                </select>
              </div>

              {/* Members */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#444748]/60 uppercase tracking-tighter">
                    {mode === 'specific_one' ? 'Membre' : 'Membres éligibles'}
                  </label>
                  {mode !== 'specific_one' && eligibleTeam.length > 0 && (
                    <div className="flex gap-2 text-[11px] font-semibold">
                      <button onClick={selectAll} className="text-[#1b1c1b] dark:text-white hover:underline">Tout sélectionner</button>
                      <span className="text-[#444748]/40">·</span>
                      <button onClick={clearAll} className="text-[#444748] hover:underline">Effacer</button>
                    </div>
                  )}
                </div>
                {loadingTeam ? (
                  <div className="flex items-center gap-2 text-xs text-[#444748]"><Loader2 className="h-3 w-3 animate-spin" /> Chargement de l'équipe...</div>
                ) : eligibleTeam.length === 0 ? (
                  <p className="text-xs text-[#444748]/60 italic">Aucun membre dans l'équipe. Invitez d'abord vos closers/setters.</p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-2">
                    {eligibleTeam.map(m => (
                      <label key={m.user_id} className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-neutral-900 border border-[#c4c7c7]/20 cursor-pointer hover:bg-[#eae8e7]/40">
                        <input
                          type={mode === 'specific_one' ? 'radio' : 'checkbox'}
                          name={`assign-member-${provider}`}
                          checked={selectedIds.includes(m.user_id)}
                          onChange={() => toggleMember(m.user_id)}
                          className="h-4 w-4 accent-[#1b1c1b]"
                        />
                        <span className="text-sm font-medium flex-1">{memberLabel(m)}</span>
                        {m.role && <span className="text-[10px] uppercase font-bold text-[#444748]/50">{m.role}</span>}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 bg-[#1b1c1b] text-white rounded-full font-bold text-sm flex items-center gap-2 hover:bg-[#1b1c1b]/80 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
