import { useState, useEffect } from 'react'
import { X, Plus, Pencil, Trash2, Building2, Check, Loader2, Star } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'

export interface IssuerProfile {
  id: string
  name: string
  companyName: string
  address: string
  city: string
  zip: string
  country: string
  siret: string
  email: string
  phone: string
  isDefault: boolean
}

interface BusinessIssuerProfilesModalProps {
  isOpen: boolean
  onClose: () => void
}

export function BusinessIssuerProfilesModal({ isOpen, onClose }: BusinessIssuerProfilesModalProps) {
  const { ownerUserId, user } = useBusinessAuth()
  const effectiveUserId = ownerUserId || user?.id

  const [profiles, setProfiles] = useState<IssuerProfile[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formCompanyName, setFormCompanyName] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formCity, setFormCity] = useState('')
  const [formZip, setFormZip] = useState('')
  const [formCountry, setFormCountry] = useState('France')
  const [formSiret, setFormSiret] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPhone, setFormPhone] = useState('')

  const fetchProfiles = async () => {
    if (!effectiveUserId) return
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('issuer_profiles')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('created_at', { ascending: true })

      if (error) throw error

      if (data) {
        const mapped = data.map(p => ({
          id: p.id,
          name: p.name,
          companyName: p.company_name,
          address: p.address || '',
          city: p.city || '',
          zip: p.zip || '',
          country: p.country || 'France',
          siret: p.siret || '',
          email: p.email || '',
          phone: p.phone || '',
          isDefault: p.is_default
        }))
        setProfiles(mapped)
      }
    } catch (err) {
      console.error('Erreur chargement profils:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchProfiles()
    }
  }, [isOpen, effectiveUserId])

  const saveProfile = async (profileData: any) => {
    if (!effectiveUserId) {
      alert("Session expirée, veuillez vous reconnecter.")
      return
    }
    setIsLoading(true)
    try {
      const dbData = {
        user_id: effectiveUserId,
        name: profileData.name,
        company_name: profileData.companyName,
        address: profileData.address,
        city: profileData.city,
        zip: profileData.zip,
        country: profileData.country,
        siret: profileData.siret,
        email: profileData.email,
        phone: profileData.phone,
        is_default: profileData.isDefault
      }

      if (editingId) {
        const { error } = await supabase.from('issuer_profiles').update(dbData).eq('id', editingId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('issuer_profiles').insert([dbData])
        if (error) throw error
      }

      await fetchProfiles()
      resetForm()
    } catch (err) {
      console.error('Erreur sauvegarde profil:', err)
      alert("Erreur lors de la sauvegarde. Vérifiez votre connexion.")
    } finally {
      setIsLoading(false)
    }
  }

  const deleteProfile = async (id: string) => {
    try {
      const { error } = await supabase.from('issuer_profiles').delete().eq('id', id)
      if (error) throw error
      await fetchProfiles()
    } catch (err) {
      console.error('Erreur suppression:', err)
    }
  }

  const setDefault = async (id: string) => {
    if (!effectiveUserId) return
    try {
      await supabase.from('issuer_profiles')
        .update({ is_default: false })
        .eq('user_id', effectiveUserId)

      await supabase.from('issuer_profiles')
        .update({ is_default: true })
        .eq('id', id)

      await fetchProfiles()
    } catch (err) {
      console.error('Erreur défaut:', err)
    }
  }

  const resetForm = () => {
    setIsAdding(false)
    setEditingId(null)
    setFormName('')
    setFormCompanyName('')
    setFormAddress('')
    setFormCity('')
    setFormZip('')
    setFormCountry('France')
    setFormSiret('')
    setFormEmail('')
    setFormPhone('')
  }

  const handleEdit = (profile: IssuerProfile) => {
    setEditingId(profile.id)
    setIsAdding(true)
    setFormName(profile.name)
    setFormCompanyName(profile.companyName)
    setFormAddress(profile.address)
    setFormCity(profile.city)
    setFormZip(profile.zip)
    setFormCountry(profile.country)
    setFormSiret(profile.siret)
    setFormEmail(profile.email)
    setFormPhone(profile.phone)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim() || !formCompanyName.trim()) {
      alert('Veuillez entrer au moins un nom de profil et un nom de société')
      return
    }

    const profileData = {
      name: formName,
      companyName: formCompanyName,
      address: formAddress,
      city: formCity,
      zip: formZip,
      country: formCountry,
      siret: formSiret,
      email: formEmail,
      phone: formPhone,
      isDefault: profiles.length === 0
    }

    saveProfile(profileData)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-4xl max-h-[85vh] flex flex-col bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl ring-1 ring-[#c4c7c7]/20 dark:ring-neutral-700">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#c4c7c7]/10 dark:border-neutral-800 p-6 flex-shrink-0">
          <div>
            <h2 className="text-2xl font-extrabold font-['Manrope'] text-[#1b1c1b] dark:text-white">Profils Émetteur</h2>
            <p className="mt-1 text-sm text-[#444748] dark:text-neutral-400">Gérez vos informations d'entreprise</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-[#444748] hover:bg-[#eae8e7] dark:hover:bg-neutral-800 dark:text-neutral-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {/* Add button */}
          {!isAdding && (
            <button
              onClick={() => setIsAdding(true)}
              className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#c4c7c7]/30 dark:border-neutral-700 bg-[#f5f3f2]/50 dark:bg-neutral-800/50 px-4 py-4 text-sm font-semibold text-[#444748] dark:text-neutral-400 transition-all hover:bg-[#eae8e7] dark:hover:bg-neutral-800"
            >
              <Plus className="h-4 w-4" /> Ajouter un profil émetteur
            </button>
          )}

          {/* Form */}
          {isAdding && (
            <div className="mb-6 rounded-xl border border-[#c4c7c7]/10 dark:border-neutral-800 bg-[#f5f3f2]/50 dark:bg-neutral-800/50 p-6 animate-in fade-in slide-in-from-bottom-2">
              <h3 className="mb-4 text-lg font-extrabold font-['Manrope'] text-[#1b1c1b] dark:text-white">{editingId ? 'Modifier' : 'Nouveau'} profil</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#444748] dark:text-neutral-400">Nom du profil (ex: Ma Boîte)</label>
                  <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full rounded-xl border border-[#c4c7c7]/20 dark:border-neutral-700 bg-[#f5f3f2] dark:bg-neutral-800 px-4 py-2.5 text-sm text-[#1b1c1b] dark:text-white focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49] outline-none" required />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#444748] dark:text-neutral-400">Raison sociale</label>
                  <input type="text" value={formCompanyName} onChange={(e) => setFormCompanyName(e.target.value)} className="w-full rounded-xl border border-[#c4c7c7]/20 dark:border-neutral-700 bg-[#f5f3f2] dark:bg-neutral-800 px-4 py-2.5 text-sm text-[#1b1c1b] dark:text-white focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49] outline-none" required />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#444748] dark:text-neutral-400">Adresse</label>
                  <input type="text" value={formAddress} onChange={(e) => setFormAddress(e.target.value)} className="w-full rounded-xl border border-[#c4c7c7]/20 dark:border-neutral-700 bg-[#f5f3f2] dark:bg-neutral-800 px-4 py-2.5 text-sm text-[#1b1c1b] dark:text-white focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49] outline-none" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#444748] dark:text-neutral-400">Ville</label>
                    <input type="text" value={formCity} onChange={(e) => setFormCity(e.target.value)} className="w-full rounded-xl border border-[#c4c7c7]/20 dark:border-neutral-700 bg-[#f5f3f2] dark:bg-neutral-800 px-4 py-2.5 text-sm text-[#1b1c1b] dark:text-white focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49] outline-none" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#444748] dark:text-neutral-400">Code Postal</label>
                    <input type="text" value={formZip} onChange={(e) => setFormZip(e.target.value)} className="w-full rounded-xl border border-[#c4c7c7]/20 dark:border-neutral-700 bg-[#f5f3f2] dark:bg-neutral-800 px-4 py-2.5 text-sm text-[#1b1c1b] dark:text-white focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49] outline-none" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#444748] dark:text-neutral-400">Pays</label>
                    <input type="text" value={formCountry} onChange={(e) => setFormCountry(e.target.value)} className="w-full rounded-xl border border-[#c4c7c7]/20 dark:border-neutral-700 bg-[#f5f3f2] dark:bg-neutral-800 px-4 py-2.5 text-sm text-[#1b1c1b] dark:text-white focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49] outline-none" />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#444748] dark:text-neutral-400">SIRET</label>
                  <input type="text" value={formSiret} onChange={(e) => setFormSiret(e.target.value)} className="w-full rounded-xl border border-[#c4c7c7]/20 dark:border-neutral-700 bg-[#f5f3f2] dark:bg-neutral-800 px-4 py-2.5 text-sm text-[#1b1c1b] dark:text-white focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49] outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#444748] dark:text-neutral-400">Email</label>
                    <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className="w-full rounded-xl border border-[#c4c7c7]/20 dark:border-neutral-700 bg-[#f5f3f2] dark:bg-neutral-800 px-4 py-2.5 text-sm text-[#1b1c1b] dark:text-white focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49] outline-none" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#444748] dark:text-neutral-400">Téléphone</label>
                    <input type="tel" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} className="w-full rounded-xl border border-[#c4c7c7]/20 dark:border-neutral-700 bg-[#f5f3f2] dark:bg-neutral-800 px-4 py-2.5 text-sm text-[#1b1c1b] dark:text-white focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49] outline-none" />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={resetForm} className="flex-1 rounded-xl border border-[#c4c7c7]/20 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-2.5 text-sm font-semibold text-[#444748] dark:text-neutral-300 hover:bg-[#f5f3f2] dark:hover:bg-neutral-700">
                    Annuler
                  </button>
                  <button type="submit" disabled={isLoading} className="flex-1 rounded-xl bg-[#1b1c1b] dark:bg-white px-4 py-2.5 text-sm font-semibold text-white dark:text-neutral-900 hover:bg-[#1b1c1b]/80 dark:hover:bg-neutral-200 flex justify-center items-center">
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (editingId ? 'Enregistrer' : 'Ajouter')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Empty state */}
          {profiles.length === 0 && !isAdding ? (
            <div className="bg-[#f5f3f2] dark:bg-neutral-800 rounded-xl p-12 text-center">
              <Building2 className="mx-auto mb-4 h-12 w-12 text-[#c4c7c7] dark:text-neutral-600" />
              <p className="text-[#444748] dark:text-neutral-400">Aucun profil enregistré.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {profiles.map((profile) => (
                <div key={profile.id} className="group relative rounded-xl border border-[#c4c7c7]/10 dark:border-neutral-800 bg-[#f5f3f2]/50 dark:bg-neutral-800/50 p-4 transition-all hover:bg-[#eae8e7]/50 dark:hover:bg-neutral-800">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#006c49]/10 text-[#006c49]">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-[#1b1c1b] dark:text-white">{profile.name}</h4>
                        {profile.isDefault && (
                          <span className="inline-flex items-center gap-1 bg-[#006c49]/10 text-[#006c49] px-2 py-0.5 rounded-full text-xs font-bold">
                            <Check className="h-3 w-3" /> Défaut
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-[#444748] dark:text-neutral-300">{profile.companyName}</p>
                      <div className="mt-2 text-xs text-[#444748]/60 dark:text-neutral-500">
                        {profile.siret && <span>SIRET: {profile.siret}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!profile.isDefault && (
                        <button onClick={() => setDefault(profile.id)} className="p-2 text-[#444748] dark:text-neutral-400 hover:text-yellow-500 dark:hover:text-yellow-400">
                          <Star className="h-4 w-4" />
                        </button>
                      )}
                      <button onClick={() => handleEdit(profile)} className="p-2 text-[#444748] dark:text-neutral-400 hover:text-[#006c49]">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => confirm('Supprimer ?') && deleteProfile(profile.id)} className="p-2 text-[#444748] dark:text-neutral-400 hover:text-red-500 dark:hover:text-red-400">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
