import { useState, useRef } from 'react';
import { Phone, User, Briefcase, ArrowRight, Loader2, Camera, Info, X, Check, ZoomIn, ZoomOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../lib/image-crop';

export function OnboardingModal() {
  const { user, updateProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States pour le crop
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const [formData, setFormData] = useState({
    full_name: user?.user_metadata?.full_name || '',
    phone: '',
    role: '', // Closer, Setter, ou Setter-Closer
    avatar_url: user?.user_metadata?.avatar_url || ''
  });

  // Si l'utilisateur a déjà un rôle enregistré dans Supabase, on n'affiche plus la modale
  if (user?.user_metadata?.role) return null;

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const imageDataUrl = await readFile(file);
      setImageSrc(imageDataUrl as string);
      // Reset value to allow re-selecting the same file if needed
      e.target.value = '';
    }
  };

  const readFile = (file: File) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(reader.result), false);
      reader.readAsDataURL(file);
    });
  };

  const onCropComplete = (_: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const showCroppedImage = async () => {
    try {
      setUploading(true);
      const croppedImageBlob = await getCroppedImg(
        imageSrc!,
        croppedAreaPixels
      );

      if (!croppedImageBlob) {
        throw new Error("Erreur lors de la création de l'image.");
      }

      const fileName = `${user?.id}-${Math.random()}.jpg`;
      const filePath = `${fileName}`;
      const file = new File([croppedImageBlob], fileName, { type: "image/jpeg" });

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, avatar_url: urlData.publicUrl }));
      setMessage({ type: 'success', text: 'Photo chargée !' });

      // Fermer le cropper
      setImageSrc(null);

    } catch (e: any) {
      console.error(e);
      setMessage({ type: 'error', text: "Erreur lors de l'upload." });
    } finally {
      setUploading(false);
    }
  };

  const handleCancelCrop = () => {
    setImageSrc(null);
    setZoom(1);
  }

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Sauvegarde des informations dans les métadonnées de l'utilisateur Supabase
      await updateProfile({
        full_name: formData.full_name,
        phone: formData.phone,
        role: formData.role,
        avatar_url: formData.avatar_url,
        onboarding_completed: true
      });
      // Le rafraîchissement se fait via le changement d'état du contexte Auth
    } catch (error) {
      console.error("Erreur onboarding:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    /* CORRECTION : On utilise z-[9999] pour passer au-dessus du Header/Sidebar 
       qui utilisent souvent des z-index élevés (z-50 ou z-100).
    */
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">

      {/* INTERFACE DE CROP (SUPERPOSÉE) */}
      {imageSrc && (
        <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-lg h-[400px] relative rounded-xl overflow-hidden border border-slate-700 bg-slate-900 mb-6">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
          </div>

          <div className="w-full max-w-lg space-y-6">
            <div className="flex items-center gap-4 px-4">
              <ZoomOut className="h-5 w-5 text-slate-400" />
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                aria-labelledby="Zoom"
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <ZoomIn className="h-5 w-5 text-slate-400" />
            </div>

            <div className="flex gap-4 justify-center">
              <button
                onClick={handleCancelCrop}
                disabled={uploading}
                className="px-6 py-3 rounded-xl border border-slate-700 text-slate-300 font-bold hover:bg-slate-800 transition-colors flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Annuler
              </button>
              <button
                onClick={showCroppedImage}
                disabled={uploading}
                className="px-6 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/25 flex items-center gap-2"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Valider la photo
              </button>
            </div>
          </div>
        </div>
      )}


      <div className="w-full max-w-md rounded-2xl border border-blue-500/20 bg-[#0B1121] p-8 shadow-2xl relative overflow-hidden">

        {/* Halo décoratif */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[80px] rounded-full pointer-events-none" />

        <div className="mb-6 text-center relative z-10">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/20">
            <User className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold text-white">Bien bienvenue sur CloserOS</h2>
          <p className="mt-2 text-slate-400">Configurons votre profil pour commencer</p>
        </div>

        {/* MESSAGE BETA */}
        <div className="mb-6 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm flex gap-3 relative z-10">
          <Info className="h-5 w-5 shrink-0 text-indigo-400" />
          <div>
            <p className="font-bold text-white mb-1">Version Bêta 🚀</p>
            <p className="leading-relaxed opacity-90">
              Félicitations pour votre accès ! Si vous rencontrez un bug, merci de le signaler à <a href="mailto:support@closeros.fr" className="text-white font-bold underline decoration-indigo-500/50 hover:decoration-white transition-all">support@closeros.fr</a>.
            </p>
          </div>
        </div>

        <div className="space-y-5 relative z-10">

          {/* PHOTO DE PROFIL */}
          <div className="flex justify-center mb-6">
            <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
              <div className="w-24 h-24 rounded-full border-2 border-slate-700 overflow-hidden bg-slate-800 flex items-center justify-center transition-all group-hover:border-blue-500">
                {formData.avatar_url ? (
                  <img src={formData.avatar_url} alt="Profil" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-slate-500" />
                )}
                {/* On cache le loader ici car l'upload se fait dans l'écran de crop */}
              </div>
              <div className="absolute bottom-0 right-0 bg-blue-600 p-1.5 rounded-full border-2 border-[#0B1121] text-white shadow-sm group-hover:scale-110 transition-transform">
                <Camera className="w-4 h-4" />
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={onFileChange}
                accept="image/*"
                className="hidden"
              />
            </div>
          </div>

          {message.text && (
            <div className={`text-center text-xs font-bold ${message.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
              {message.text}
            </div>
          )}

          {/* ÉTAPE 1 : IDENTITÉ */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-400 uppercase tracking-wider text-left">Nom complet</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/50 py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-sm"
                placeholder="Prénom Nom"
              />
            </div>
          </div>

          {/* ÉTAPE 2 : TÉLÉPHONE */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-400 uppercase tracking-wider text-left">Téléphone</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/50 py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-sm"
                placeholder="+33 6 12 34 56 78"
              />
            </div>
          </div>

          {/* ÉTAPE 3 : RÔLE */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-400 uppercase tracking-wider text-left">Votre spécialité</label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full appearance-none rounded-xl border border-slate-700 bg-slate-800/50 py-3 pl-10 pr-4 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer text-sm"
              >
                <option value="" className="text-slate-500">Sélectionnez votre rôle</option>
                <option value="Closer">Closer</option>
                <option value="Setter">Setter</option>
                <option value="Setter-Closer">Setter-Closer</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !formData.role || !formData.full_name}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 font-bold text-white transition-all hover:bg-blue-500 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Enregistrement...</span>
              </>
            ) : (
              <>
                <span>Terminer la configuration</span>
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}