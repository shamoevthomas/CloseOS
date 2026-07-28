import { useState } from 'react'
import { X, Users, GitMerge, Loader2, Mail, Phone, ChevronRight, ShieldCheck } from 'lucide-react'
import { useBusinessLang } from '../i18n/BusinessLangContext'
import { useBusinessProspects, type BusinessProspect } from '../contexts/BusinessProspectsContext'
import { useBusinessDuplicates } from '../hooks/useBusinessDuplicates'
import { mergeBusinessGroup } from '../lib/mergeBusinessProspects'
import { BusinessMergeProspectsModal } from './BusinessMergeProspectsModal'
import toast from 'react-hot-toast'

const displayName = (p: BusinessProspect) =>
  p.contact || `${p.firstName || ''} ${p.lastName || ''}`.trim() || (p.email || 'Prospect')

export function BusinessDuplicatesModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { lang } = useBusinessLang()
  const fr = lang !== 'en'
  const { groups } = useBusinessDuplicates()
  const { refreshProspects } = useBusinessProspects()
  const [mergingGroup, setMergingGroup] = useState<string | number | null>(null)
  const [pair, setPair] = useState<{ left: BusinessProspect; right: BusinessProspect } | null>(null)

  if (!isOpen) return null

  const quickMerge = async (group: BusinessProspect[]) => {
    const keep = group[0]
    setMergingGroup(keep.id)
    try {
      await mergeBusinessGroup(Number(keep.id), group.slice(1).map(p => Number(p.id)))
      await refreshProspects()
      toast.success(fr ? 'Doublons fusionnés' : 'Duplicates merged')
    } catch (e: any) {
      toast.error(fr ? `Échec : ${e.message || ''}` : `Failed: ${e.message || ''}`)
    } finally {
      setMergingGroup(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-white dark:bg-neutral-900 shadow-2xl border border-stone-200 dark:border-neutral-700">
        <div className="flex items-center justify-between border-b border-stone-200 dark:border-neutral-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/20">
              <Users className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>{fr ? 'Doublons détectés' : 'Duplicates found'}</h3>
              <p className="text-[11px] text-stone-400 dark:text-neutral-500">
                {groups.length > 0
                  ? (fr ? `${groups.length} groupe${groups.length > 1 ? 's' : ''} · même email ou téléphone` : `${groups.length} group${groups.length > 1 ? 's' : ''} · same email or phone`)
                  : (fr ? 'Aucun doublon' : 'None')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-stone-400 dark:text-neutral-500 hover:bg-stone-100 dark:hover:bg-neutral-800 hover:text-stone-900">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#006c49]/10 mb-4">
                <ShieldCheck className="h-7 w-7 text-[#006c49]" />
              </div>
              <p className="text-sm font-bold text-stone-900 dark:text-white">{fr ? 'Aucun doublon détecté' : 'No duplicate found'}</p>
              <p className="text-xs text-stone-400 dark:text-neutral-500 mt-1">{fr ? 'Votre base est propre. 🎉' : 'Your base is clean. 🎉'}</p>
            </div>
          ) : (
            groups.map((group, gi) => {
              const isMerging = mergingGroup === group[0].id
              return (
                <div key={gi} className="rounded-2xl border border-stone-200 dark:border-neutral-700 bg-stone-50 dark:bg-neutral-800/40 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-200 dark:border-neutral-700">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                      <Users className="h-3.5 w-3.5" /> {group.length} {fr ? 'fiches en doublon' : 'duplicate records'}
                    </span>
                    <button
                      onClick={() => quickMerge(group)}
                      disabled={isMerging}
                      className="flex items-center gap-1.5 rounded-full bg-stone-900 dark:bg-white dark:text-stone-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-stone-800 dark:hover:bg-neutral-200 disabled:opacity-50 transition-all active:scale-95"
                    >
                      {isMerging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitMerge className="h-3.5 w-3.5" />}
                      {fr ? 'Fusionner' : 'Merge'}
                    </button>
                  </div>

                  <button
                    onClick={() => setPair({ left: group[0], right: group[1] })}
                    className="w-full text-left divide-y divide-stone-200/70 dark:divide-neutral-700/50 hover:bg-stone-100/60 dark:hover:bg-neutral-800/60 transition-colors group"
                  >
                    {group.map((p, pi) => (
                      <div key={String(p.id)} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-neutral-800 border border-stone-200 dark:border-neutral-700 text-[11px] font-bold text-stone-900 dark:text-white uppercase shrink-0">
                          {displayName(p).charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-stone-900 dark:text-white truncate">{displayName(p)}</p>
                            {pi === 0 && (
                              <span className="rounded-full bg-[#006c49]/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#006c49] shrink-0">{fr ? 'Maître' : 'Primary'}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-stone-500 dark:text-neutral-400">
                            {p.email && <span className="inline-flex items-center gap-1 truncate"><Mail className="h-3 w-3 shrink-0" />{p.email}</span>}
                            {p.phone && <span className="inline-flex items-center gap-1 truncate"><Phone className="h-3 w-3 shrink-0" />{p.phone}</span>}
                          </div>
                        </div>
                        {pi === 0 && <ChevronRight className="h-4 w-4 text-stone-300 dark:text-neutral-600 group-hover:text-[#006c49] transition-colors shrink-0" />}
                      </div>
                    ))}
                    <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-neutral-500 group-hover:text-[#006c49] transition-colors">
                      {fr ? 'Comparer côte à côte →' : 'Compare side by side →'}
                    </div>
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>

      <BusinessMergeProspectsModal
        isOpen={!!pair}
        left={pair?.left || null}
        right={pair?.right || null}
        onClose={() => setPair(null)}
        onMerged={async () => { setPair(null); await refreshProspects() }}
      />
    </div>
  )
}
