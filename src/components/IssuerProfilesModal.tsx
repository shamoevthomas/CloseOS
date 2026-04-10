import { useState, useEffect } from 'react'
import { X, Plus, Pencil, Trash2, Building2, Check, Loader2, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'

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

interface IssuerProfilesModalProps {
  isOpen: boolean
  onClose: () => void
}

export function IssuerProfilesModal({ isOpen, onClose }: IssuerProfilesModalProps) {
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

  // Chargement depuis Supabase
  const fetchProfiles = async () => {
    setIsLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('issuer_profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

      if (error) throw error

      if (data) {
        const mapped = data.map(p => ({
          id: p.id,
          name: p.name,
          companyName: p.company_name, // Mapping DB -> State
          address: p.address || '',
          city: p.city || '',
          zip: p.zip || '',
          country: p.country || 'France',
          siret: p.siret || '',
          email: p.email || '',
          phone: p.phone || '',
          isDefault: p.is_default // Mapping DB -> State
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
  }, [isOpen])

  // Sauvegarde
  const saveProfile = async (profileData: any) => {
    setIsLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert("Session expirée, veuillez vous reconnecter.")
        return
      }

      // Mapping State -> DB
      const dbData = {
        user_id: user.id,
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

  // Suppression
  const deleteProfile = async (id: string) => {
    try {
      const { error } = await supabase.from('issuer_profiles').delete().eq('id', id)
      if (error) throw error
      await fetchProfiles()
    } catch (err) {
      console.error('Erreur suppression:', err)
    }
  }

  // Définir par défaut
  const setDefault = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 1. Reset tous les profils de l'utilisateur
      await supabase.from('issuer_profiles')
        .update({ is_default: false })
        .eq('user_id', user.id)

      // 2. Set le nouveau
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
      isDefault: profiles.length === 0 // Premier profil = défaut auto
    }

    saveProfile(profileData)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl bg-[#1a1a1a] shadow-[0_20px_40px_rgba(0,0,0,0.2)] ring-1 ring-white/[0.08]">
        <div className="flex items-center justify-between border-b border-white/[0.08] p-6 flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-white">Profils Émetteur</h2>
            <p className="mt-1 text-sm text-white/40">Gérez vos informations d'entreprise</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-white/40 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {!isAdding && (
            <button
              onClick={() => setIsAdding(true)}
              className="mb-6 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/[0.08] bg-white/[0.03] px-4 py-4 text-sm font-semibold text-white/60 transition-all hover:border-white/20 hover:bg-white/10"
            >
              <Plus className="h-4 w-4" /> Ajouter un profil émetteur
            </button>
          )}

          {isAdding && (
            <div className="mb-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-2xl p-6 animate-in fade-in slide-in-from-bottom-2">
              <h3 className="mb-4 text-lg font-bold text-white">{editingId ? 'Modifier' : 'Nouveau'} profil</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-white/40">Nom du profil (ex: Ma Boîte)</label>
                  <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none" required />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-white/40">Raison sociale</label>
                  <input type="text" value={formCompanyName} onChange={(e) => setFormCompanyName(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none" required />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-white/40">Adresse</label>
                  <input type="text" value={formAddress} onChange={(e) => setFormAddress(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className="mb-2 block text-sm font-medium text-white/40">Ville</label><input type="text" value={formCity} onChange={(e) => setFormCity(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none" /></div>
                  <div><label className="mb-2 block text-sm font-medium text-white/40">Code Postal</label><input type="text" value={formZip} onChange={(e) => setFormZip(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none" /></div>
                  <div><label className="mb-2 block text-sm font-medium text-white/40">Pays</label><input type="text" value={formCountry} onChange={(e) => setFormCountry(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none" /></div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-white/40">SIRET</label>
                  <input type="text" value={formSiret} onChange={(e) => setFormSiret(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="mb-2 block text-sm font-medium text-white/40">Email</label><input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none" /></div>
                  <div><label className="mb-2 block text-sm font-medium text-white/40">Téléphone</label><input type="tel" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none" /></div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={resetForm} className="flex-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/10">Annuler</button>
                  <button type="submit" disabled={isLoading} className="flex-1 rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400 flex justify-center items-center">
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (editingId ? 'Enregistrer' : 'Ajouter')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {profiles.length === 0 && !isAdding ? (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-12 text-center">
              <Building2 className="mx-auto mb-4 h-12 w-12 text-white/40" />
              <p className="text-white/40">Aucun profil enregistré.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {profiles.map((profile) => (
                <div key={profile.id} className="group relative rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 transition-all hover:bg-white/10">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-white">{profile.name}</h4>
                        {profile.isDefault && <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-semibold text-purple-400"><Check className="h-3 w-3" /> Défaut</span>}
                      </div>
                      <p className="mt-1 text-sm text-white/60">{profile.companyName}</p>
                      <div className="mt-2 text-xs text-white/40">
                        {profile.siret && <span>SIRET: {profile.siret}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!profile.isDefault && (
                        <button onClick={() => setDefault(profile.id)} className="p-2 text-white/40 hover:text-yellow-400"><Star className="h-4 w-4" /></button>
                      )}
                      <button onClick={() => handleEdit(profile)} className="p-2 text-white/40 hover:text-blue-400"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => confirm('Supprimer ?') && deleteProfile(profile.id)} className="p-2 text-white/40 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
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