import { useState, useEffect } from 'react'
import { X, Mail, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface EmailCapturePopupProps {
  closerName: string
  shareLinkId: string
}

export function EmailCapturePopup({ closerName, shareLinkId }: EmailCapturePopupProps) {
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Check if already dismissed in this session
    const wasDismissed = sessionStorage.getItem(`spectator_popup_${shareLinkId}`)
    if (wasDismissed) {
      setDismissed(true)
      return
    }

    const timer = setTimeout(() => {
      setVisible(true)
    }, 10000) // 10 seconds

    return () => clearTimeout(timer)
  }, [shareLinkId])

  const handleDismiss = () => {
    setVisible(false)
    setDismissed(true)
    sessionStorage.setItem(`spectator_popup_${shareLinkId}`, 'true')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || loading) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('spectator_leads')
        .insert({ share_link_id: shareLinkId, email })

      if (error) throw error
      setSubmitted(true)
      setTimeout(() => {
        handleDismiss()
      }, 2000)
    } catch (err) {
      console.error('Error saving lead:', err)
    } finally {
      setLoading(false)
    }
  }

  if (dismissed || !visible) return null

  return (
    <div className="fixed bottom-20 right-4 z-50 w-80 animate-in slide-in-from-bottom-5 duration-500">
      <div className="rounded-2xl bg-white p-6 shadow-[0_20px_40px_rgba(27,28,27,0.12)] relative" style={{ boxShadow: 'inset 0 0 0 1px rgba(196,199,199,0.1), 0 20px 40px rgba(27,28,27,0.12)' }}>
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1 rounded-full text-[#444748]/40 hover:text-[#1b1c1b] hover:bg-[#f5f3f2] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {submitted ? (
          <div className="py-2 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#006c49]/10">
              <Mail className="h-6 w-6 text-[#006c49]" />
            </div>
            <p className="text-sm font-bold text-[#1b1c1b]" style={{ fontFamily: 'Manrope, sans-serif' }}>Merci !</p>
            <p className="text-xs text-[#444748] mt-1">Vous recevrez les mises à jour</p>
          </div>
        ) : (
          <>
            <div className="mb-5 pr-6">
              <p className="text-sm font-bold text-[#1b1c1b]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Suivez les performances de {closerName || 'ce closer'}
              </p>
              <p className="text-xs text-[#444748] mt-1.5">
                Recevez les mises à jour par email
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                required
                className="flex-1 bg-transparent border-b-2 border-[#c4c7c7]/30 py-2.5 text-sm text-[#1b1c1b] placeholder-[#444748]/40 focus:border-[#006c49] focus:ring-0 outline-none font-medium"
              />
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center rounded-full bg-[#1b1c1b] px-4 py-2.5 text-white hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>

            <p className="mt-3 text-center text-[9px] text-[#444748]/40 leading-relaxed">
              En continuant, vous acceptez d'être recontacté(e) et que vos informations soient enregistrées dans notre base de données.
            </p>

            <button
              onClick={handleDismiss}
              className="mt-3 w-full text-center text-[10px] font-bold uppercase tracking-widest text-[#444748]/40 hover:text-[#444748] transition-colors"
            >
              Non merci
            </button>
          </>
        )}
      </div>
    </div>
  )
}
