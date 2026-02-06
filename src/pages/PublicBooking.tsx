import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import Cal, { getCalApi } from "@calcom/embed-react"
import { Loader2 } from 'lucide-react'

export function PublicBooking() {
  // On récupère le "slug" dans l'URL. 
  // Ex: si l'URL est /book/thomas-shamoev, alors slug = "thomas-shamoev"
  const { slug } = useParams<{ slug: string }>()

  useEffect(() => {
    (async function () {
      const cal = await getCalApi({});
      cal("ui", {
        "theme": "dark",
        "styles": {
          "branding": {
            "brandColor": "#000000"
          }
        },
        "hideEventTypeDetails": false,
        "layout": "month_view"
      });
    })();
  }, []);

  if (!slug) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p>Lien incomplet.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header Minimaliste CloseOS (Optionnel, pour rassurer le prospect) */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm py-4">
        <div className="mx-auto max-w-7xl px-6 flex justify-center">
          <span className="text-lg font-bold text-white tracking-tight">
            Close<span className="text-blue-500">OS</span>
          </span>
        </div>
      </div>

      {/* Conteneur Cal.com */}
      <div className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 flex flex-col justify-center">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden shadow-2xl">
          <Cal 
            calLink={slug} // On injecte le pseudo ici (ex: "thomas-shamoev")
            style={{ width: "100%", height: "100%", minHeight: "600px" }}
            config={{
              layout: 'month_view',
              theme: 'dark'
            }}
          />
        </div>
      </div>
      
      {/* Footer Discret */}
      <div className="py-6 text-center text-xs text-slate-600">
        Propulsé par CloseOS & Cal.com
      </div>
    </div>
  )
}