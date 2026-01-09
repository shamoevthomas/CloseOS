import { useState, useEffect } from 'react'
import { X, Plus, Edit2, Trash2, Building2, Check, Loader2 } from 'lucide-react' // Ajout de Loader2 pour le feedback
import { cn } from '../lib/utils'
import { supabase } from '../lib/supabase' // Importation de supabase

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

// MODIFIÉ : Retrait de STORAGE_KEY car on utilise Supabase maintenant

export function IssuerProfilesModal({ isOpen, onClose }: IssuerProfilesModalProps) {
  const [profiles, setProfiles] = useState<IssuerProfile[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false) // State pour le chargement

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

  // MODIFIÉ : Chargement depuis Supabase avec mapping des colonnes
  const fetchProfiles = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('issuer_profiles')
        .select('*')
        .order('created_at', { ascending: true })

      if (error) throw error

      if (data) {
        const mapped = data.map(p => ({
          id: p.id,
          name: p.name,
          companyName: p.company_name, // Mapping snake_case -> camelCase
          address: p.address,
          city: p.city,
          zip: p.zip,
          country: p.country,
          siret: p.siret,
          email: p.email,
          phone: p.phone,
          isDefault: p.is_default // Mapping snake_case -> camelCase
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

  // MODIFIÉ : Sauvegarde dans Supabase
  const saveProfile = async (profile: any) => {
    setIsLoading(true)
    try {
      // Préparation des données pour SQL (snake_case)
      const dbData = {
        name: profile.name,
        company_name: profile.companyName,
        address: profile.address,
        city: profile.city,
        zip: profile.zip,
        country: profile.country,
        siret: profile.siret,
        email: profile.email,
        phone: profile.phone,
        is_default: profile.isDefault
      }

      if (editingId) {
        await supabase.from('issuer_profiles').update(dbData).eq('id', editingId)
      } else {
        await supabase.from('issuer_profiles').insert([dbData])
      }

      await fetchProfiles()
      resetForm()
    } catch (err) {
      console.error('Erreur sauvegarde profil:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // MODIFIÉ : Suppression dans Supabase
  const deleteProfile = async (id: string) => {
    try {
      await supabase.from('issuer_profiles').delete().eq('id', id)
      await fetchProfiles()
    } catch (err) {
      console.error('Erreur suppression profil:', err)
    }
  }

  // MODIFIÉ : Gestion du profil par défaut dans Supabase
  const setDefault = async (id: string) => {
    try {
      // 1. On retire le défaut à tout le monde
      await supabase.from('issuer_profiles').update({ is_default: false }).neq('id', id)
      // 2. On met le nouveau par défaut
      await supabase.from('issuer_profiles').update({ is_default: true }).eq('id', id)
      await fetchProfiles()
    } catch (err) {
      console.error('Erreur profil par défaut:', err)
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

    const profile = {
      name: formName,
      companyName: formCompanyName,
      address: formAddress,
      city: formCity,
      zip: formZip,
      country: formCountry,
      siret: formSiret,
      email: formEmail,
      phone: formPhone,
      isDefault: profiles.length === 0, // Premier profil devient défaut
    }

    saveProfile(profile)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[85vh] flex flex-col rounded-xl bg-slate-900 shadow-2xl ring-1 ring-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-6 flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-white">Profils Émetteur</h2>
            <p className="mt-1 text-sm text-slate-400">
              Gérez vos informations d'entreprise pour accélérer la création de factures
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {/* Add New Button */}
          {!isAdding && (
            <button
              onClick={() => setIsAdding(true)}
              className="mb-6 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-700 bg-slate-800/50 px-4 py-4 text-sm font-semibold text-slate-300 transition-all hover:border-slate-600 hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              Ajouter un profil émetteur
            </button>
          )}

          {/* Add/Edit Form */}
          {isAdding && (
            <div className="mb-6 rounded-xl border border-slate-800 bg-slate-800/50 p-6">
              <h3 className="mb-4 text-lg font-bold text-white">
                {editingId ? 'Modifier' : 'Nouveau'} profil émetteur
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Profile Name */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-400">
                    Nom du profil
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ex: Entreprise Principale, Freelance..."
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                    required
                  />
                </div>

                {/* Company Name */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-400">
                    Raison sociale
                  </label>
                  <input
                    type="text"
                    value={formCompanyName}
                    onChange={(e) => setFormCompanyName(e.target.value)}
                    placeholder="Ex: ACME SARL, Jean Dupont EI..."
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                    required
                  />
                </div>

                {/* Address */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-400">Adresse</label>
                  <input
                    type="text"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    placeholder="Ex: 123 Rue de la Paix"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                  />
                </div>

                {/* City, Zip, Country */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-400">Ville</label>
                    <input
                      type="text"
                      value={formCity}
                      onChange={(e) => setFormCity(e.target.value)}
                      placeholder="Paris"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-400">
                      Code Postal
                    </label>
                    <input
                      type="text"
                      value={formZip}
                      onChange={(e) => setFormZip(e.target.value)}
                      placeholder="75001"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-400">Pays</label>
                    <input
                      type="text"
                      value={formCountry}
                      onChange={(e) => setFormCountry(e.target.value)}
                      placeholder="France"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* SIRET */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-400">
                    SIRET / N° TVA
                  </label>
                  <input
                    type="text"
                    value={formSiret}
                    onChange={(e) => setFormSiret(e.target.value)}
                    placeholder="123 456 789 00012"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                  />
                </div>

                {/* Email & Phone */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-400">Email</label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="contact@entreprise.com"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-400">
                      Téléphone
                    </label>
                    <input
                      type="tel"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="+33 1 23 45 67 89"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-800"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 rounded-lg bg-purple-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-purple-600 flex justify-center"
                  >
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (editingId ? 'Enregistrer' : 'Ajouter')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* List of Profiles */}
          {profiles.length === 0 && !isAdding ? (
            <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-12 text-center">
              <Building2 className="mx-auto mb-4 h-12 w-12 text-slate-600" />
              <p className="text-lg font-semibold text-slate-400">Aucun profil émetteur</p>
              <p className="mt-2 text-sm text-slate-500">
                Ajoutez vos informations d'entreprise pour accélérer la création de factures
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className="group relative rounded-lg border border-slate-800 bg-slate-800/30 p-4 transition-all hover:border-slate-700 hover:bg-slate-800/50"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
                      <Building2 className="h-5 w-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-white">{profile.name}</h4>
                        {profile.isDefault && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-semibold text-purple-400">
                            <Check className="h-3 w-3" />
                            Par défaut
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-medium text-slate-300">{profile.companyName}</p>

                      {/* Details */}
                      <div className="mt-2 space-y-1 text-xs text-slate-500">
                        {profile.address && (
                          <p>
                            {profile.address}
                            {profile.city && `, ${profile.city}`}
                            {profile.zip && ` ${profile.zip}`}
                            {profile.country && `, ${profile.country}`}
                          </p>
                        )}
                        {profile.siret && <p>SIRET: {profile.siret}</p>}
                        <div className="flex gap-4">
                          {profile.email && <p>📧 {profile.email}</p>}
                          {profile.phone && <p>📱 {profile.phone}</p>}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                      {!profile.isDefault && (
                        <button
                          onClick={() => setDefault(profile.id)}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-purple-400"
                          title="Définir par défaut"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(profile)}
                        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-blue-400"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Êtes-vous sûr de vouloir supprimer ce profil émetteur ?')) {
                            deleteProfile(profile.id)
                          }
                        }}
                        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-red-400"
                      >
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