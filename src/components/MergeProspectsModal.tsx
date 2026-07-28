import { useState, useEffect } from 'react'
import { X, GitMerge, Loader2, Check, Mail, Phone, Building2, Tag, User } from 'lucide-react'
import { cn } from '../lib/utils'
import { useLanguage } from '../contexts/LanguageContext'
import { type Prospect } from '../contexts/ProspectsContext'
import { mergeProspectPair } from '../lib/mergeProspects'
import toast from 'react-hot-toast'

interface MergeProspectsModalProps {
  isOpen: boolean
  left: Prospect | null
  right: Prospect | null
  onClose: () => void
  onMerged: (keptId: number) => void
}

const displayName = (p: Prospect) =>
  p.contact || `${p.firstName || ''} ${p.lastName || ''}`.trim() || (p.email || 'Prospect')

export function MergeProspectsModal({ isOpen, left, right, onClose, onMerged }: MergeProspectsModalProps) {
  const { lang } = useLanguage()
  const fr = lang !== 'en'
  const [keepSide, setKeepSide] = useState<'left' | 'right'>('left')
  const [merging, setMerging] = useState(false)

  useEffect(() => { if (isOpen) setKeepSide('left') }, [isOpen, left, right])

  if (!isOpen || !left || !right) return null

  const handleMerge = async () => {
    const keep = keepSide === 'left' ? left : right
    const dup = keepSide === 'left' ? right : left
    setMerging(true)
    try {
      await mergeProspectPair(Number(keep.id), Number(dup.id))
      toast.success(fr ? 'Fiches fusionnées' : 'Records merged')
      onMerged(Number(keep.id))
    } catch (e: any) {
      toast.error(fr ? `Échec de la fusion : ${e.message || ''}` : `Merge failed: ${e.message || ''}`)
    } finally {
      setMerging(false)
    }
  }

  const Card = ({ p, side }: { p: Prospect; side: 'left' | 'right' }) => {
    const kept = keepSide === side
    const rows: { icon: any; label: string; value: string | null | undefined }[] = [
      { icon: Mail, label: fr ? 'Email' : 'Email', value: p.email },
      { icon: Phone, label: fr ? 'Téléphone' : 'Phone', value: p.phone },
      { icon: Building2, label: fr ? 'Entreprise' : 'Company', value: p.company },
      { icon: Tag, label: fr ? 'Offre' : 'Offer', value: p.offer },
    ]
    return (
      <button
        type="button"
        onClick={() => setKeepSide(side)}
        className={cn(
          'flex-1 min-w-0 text-left rounded-2xl border p-5 transition-all',
          kept
            ? 'border-sky-500 ring-2 ring-sky-500/30 bg-sky-50/60 dark:bg-sky-500/10'
            : 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:border-slate-300'
        )}
      >
        <div className="flex items-center justify-between mb-4">
          <span className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest',
            kept ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-400 dark:text-neutral-500'
          )}>
            {kept ? <><Check className="h-3 w-3" /> {fr ? 'Conservée' : 'Kept'}</> : (fr ? 'Cliquer pour conserver' : 'Click to keep')}
          </span>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 dark:bg-white/10 text-sm font-bold text-slate-900 dark:text-white uppercase shrink-0">
            {p.avatar_url ? <img src={p.avatar_url} alt="" className="h-full w-full rounded-full object-cover" /> : (displayName(p).charAt(0) || <User className="h-5 w-5" />)}
          </div>
          <div className="min-w-0">
            <p className="text-base font-extrabold text-slate-900 dark:text-white truncate">{displayName(p)}</p>
            <p className="text-[11px] text-slate-400 dark:text-neutral-500">
              {fr ? 'Créé le' : 'Created'} {p.created_at || p.dateAdded ? new Date((p.created_at || p.dateAdded)!).toLocaleDateString(fr ? 'fr-FR' : 'en-US') : '—'}
            </p>
          </div>
        </div>
        <div className="space-y-2.5">
          {rows.map((r, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <r.icon className="h-3.5 w-3.5 text-slate-400 dark:text-neutral-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-500">{r.label}</p>
                <p className={cn('text-sm break-words', r.value ? 'text-slate-800 dark:text-neutral-200 font-medium' : 'text-slate-300 dark:text-neutral-600 italic')}>
                  {r.value || (fr ? 'Vide' : 'Empty')}
                </p>
              </div>
            </div>
          ))}
          {(p.value ?? 0) > 0 && (
            <div className="flex items-center gap-2.5 pt-1">
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-500">{fr ? 'Montant' : 'Value'}</span>
              <span className="text-sm font-bold text-sky-600 dark:text-sky-400">{Number(p.value).toLocaleString(fr ? 'fr-FR' : 'en-US')}€</span>
            </div>
          )}
        </div>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-[#1a1a1a] shadow-2xl border border-slate-200 dark:border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/20">
              <GitMerge className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{fr ? 'Fusionner les doublons' : 'Merge duplicates'}</h3>
              <p className="text-[11px] text-slate-400 dark:text-neutral-500">{fr ? 'Choisissez la fiche à conserver' : 'Choose the record to keep'}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 dark:text-neutral-500 hover:bg-slate-100 hover:text-slate-900">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body : deux fiches + bouton fusionner au milieu */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="flex flex-col lg:flex-row items-stretch gap-4">
            <Card p={left} side="left" />

            {/* Bouton de fusion central */}
            <div className="flex lg:flex-col items-center justify-center gap-2 shrink-0">
              <div className="hidden lg:block w-px flex-1 bg-slate-200 dark:bg-white/10" />
              <button
                onClick={handleMerge}
                disabled={merging}
                className="flex items-center gap-2 rounded-full bg-sky-600 px-5 py-3 text-sm font-bold text-white hover:bg-sky-500 shadow-xl shadow-sky-500/20 disabled:opacity-50 transition-all whitespace-nowrap"
              >
                {merging ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitMerge className="h-4 w-4" />}
                {fr ? 'Fusionner' : 'Merge'}
              </button>
              <div className="hidden lg:block w-px flex-1 bg-slate-200 dark:bg-white/10" />
            </div>

            <Card p={right} side="right" />
          </div>

          <p className="mt-5 text-center text-[11px] text-slate-400 dark:text-neutral-500 leading-relaxed max-w-lg mx-auto">
            {fr
              ? "Les informations manquantes de la fiche conservée seront complétées avec celles de l'autre (RDV, rappels, notes, tâches réassignés). Le doublon sera ensuite supprimé. Action irréversible."
              : 'Missing fields of the kept record will be filled from the other (appointments, reminders, notes, tasks reassigned). The duplicate is then deleted. This cannot be undone.'}
          </p>
        </div>
      </div>
    </div>
  )
}
