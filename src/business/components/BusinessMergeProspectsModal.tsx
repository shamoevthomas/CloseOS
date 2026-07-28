import { useState, useEffect } from 'react'
import { X, GitMerge, Loader2, Check, Mail, Phone, Building2, Tag, User } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useBusinessLang } from '../i18n/BusinessLangContext'
import { type BusinessProspect } from '../contexts/BusinessProspectsContext'
import { mergeBusinessProspectPair } from '../lib/mergeBusinessProspects'
import toast from 'react-hot-toast'

interface Props {
  isOpen: boolean
  left: BusinessProspect | null
  right: BusinessProspect | null
  onClose: () => void
  onMerged: (keptId: number) => void
}

const displayName = (p: BusinessProspect) =>
  p.contact || `${p.firstName || ''} ${p.lastName || ''}`.trim() || (p.email || 'Prospect')

export function BusinessMergeProspectsModal({ isOpen, left, right, onClose, onMerged }: Props) {
  const { lang } = useBusinessLang()
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
      await mergeBusinessProspectPair(Number(keep.id), Number(dup.id))
      toast.success(fr ? 'Fiches fusionnées' : 'Records merged')
      onMerged(Number(keep.id))
    } catch (e: any) {
      toast.error(fr ? `Échec de la fusion : ${e.message || ''}` : `Merge failed: ${e.message || ''}`)
    } finally {
      setMerging(false)
    }
  }

  const Card = ({ p, side }: { p: BusinessProspect; side: 'left' | 'right' }) => {
    const kept = keepSide === side
    const rows: { icon: any; label: string; value: string | null | undefined }[] = [
      { icon: Mail, label: 'Email', value: p.email },
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
            ? 'border-[#006c49] ring-2 ring-[#006c49]/25 bg-[#006c49]/5'
            : 'border-stone-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/40 hover:border-stone-300'
        )}
      >
        <div className="flex items-center justify-between mb-4">
          <span className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest',
            kept ? 'bg-[#006c49] text-white' : 'bg-stone-100 dark:bg-neutral-800 text-stone-400 dark:text-neutral-500'
          )}>
            {kept ? <><Check className="h-3 w-3" /> {fr ? 'Conservée' : 'Kept'}</> : (fr ? 'Cliquer pour conserver' : 'Click to keep')}
          </span>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 dark:bg-neutral-800 text-sm font-bold text-stone-900 dark:text-white uppercase shrink-0">
            {displayName(p).charAt(0) || <User className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <p className="text-base font-extrabold text-stone-900 dark:text-white truncate" style={{ fontFamily: 'Manrope, sans-serif' }}>{displayName(p)}</p>
            <p className="text-[11px] text-stone-400 dark:text-neutral-500">
              {fr ? 'Créé le' : 'Created'} {p.created_at ? new Date(p.created_at).toLocaleDateString(fr ? 'fr-FR' : 'en-US') : '—'}
            </p>
          </div>
        </div>
        <div className="space-y-2.5">
          {rows.map((r, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <r.icon className="h-3.5 w-3.5 text-stone-400 dark:text-neutral-500 mt-0.5 shrink-0" strokeWidth={1.5} />
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-widest text-stone-400 dark:text-neutral-500">{r.label}</p>
                <p className={cn('text-sm break-words', r.value ? 'text-stone-800 dark:text-neutral-200 font-medium' : 'text-stone-300 dark:text-neutral-600 italic')}>
                  {r.value || (fr ? 'Vide' : 'Empty')}
                </p>
              </div>
            </div>
          ))}
          {(p.value ?? 0) > 0 && (
            <div className="flex items-center gap-2.5 pt-1">
              <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400 dark:text-neutral-500">{fr ? 'Montant' : 'Value'}</span>
              <span className="text-sm font-bold text-[#006c49]">{Number(p.value).toLocaleString(fr ? 'fr-FR' : 'en-US')}€</span>
            </div>
          )}
        </div>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl bg-white dark:bg-neutral-900 shadow-2xl border border-stone-200 dark:border-neutral-700">
        <div className="flex items-center justify-between border-b border-stone-200 dark:border-neutral-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#006c49]/15">
              <GitMerge className="h-4 w-4 text-[#006c49]" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>{fr ? 'Fusionner les doublons' : 'Merge duplicates'}</h3>
              <p className="text-[11px] text-stone-400 dark:text-neutral-500">{fr ? 'Choisissez la fiche à conserver' : 'Choose the record to keep'}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-stone-400 dark:text-neutral-500 hover:bg-stone-100 dark:hover:bg-neutral-800 hover:text-stone-900">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-col lg:flex-row items-stretch gap-4">
            <Card p={left} side="left" />
            <div className="flex lg:flex-col items-center justify-center gap-2 shrink-0">
              <div className="hidden lg:block w-px flex-1 bg-stone-200 dark:bg-neutral-700" />
              <button
                onClick={handleMerge}
                disabled={merging}
                className="flex items-center gap-2 rounded-full bg-stone-900 dark:bg-white dark:text-stone-900 px-5 py-3 text-sm font-bold text-white hover:bg-stone-800 dark:hover:bg-neutral-200 shadow-xl disabled:opacity-50 transition-all whitespace-nowrap active:scale-95"
              >
                {merging ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitMerge className="h-4 w-4" />}
                {fr ? 'Fusionner' : 'Merge'}
              </button>
              <div className="hidden lg:block w-px flex-1 bg-stone-200 dark:bg-neutral-700" />
            </div>
            <Card p={right} side="right" />
          </div>

          <p className="mt-5 text-center text-[11px] text-stone-400 dark:text-neutral-500 leading-relaxed max-w-lg mx-auto">
            {fr
              ? "Les informations manquantes de la fiche conservée seront complétées avec celles de l'autre (RDV, rappels, paiements, tags, historique réassignés). Le doublon sera ensuite supprimé. Action irréversible."
              : 'Missing fields of the kept record will be filled from the other (appointments, reminders, payments, tags, history reassigned). The duplicate is then deleted. This cannot be undone.'}
          </p>
        </div>
      </div>
    </div>
  )
}
