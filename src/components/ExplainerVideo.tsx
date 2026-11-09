import { useRef, useState } from 'react'
import { Play } from 'lucide-react'

// Vidéo explicative (motion design) des landing pages Sales et Business.
// Rien n'est téléchargé avant le clic (preload="none") : seule l'image d'aperçu charge avec la page.
type Props = {
  src: string
  poster: string
  kicker: string
  title: string
  duration: string
  accent?: 'sky' | 'dark'
  onPlay?: () => void
  onStop?: () => void
}

export function ExplainerVideo({ src, poster, kicker, title, duration, accent = 'dark', onPlay, onStop }: Props) {
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)

  const start = () => {
    setPlaying(true)
    requestAnimationFrame(() => { ref.current?.play().catch(() => {}) })
  }

  const kickerCls = accent === 'sky' ? 'text-sky-600' : 'text-stone-500'
  const btnCls = accent === 'sky' ? 'bg-sky-600 group-hover:bg-sky-500' : 'bg-[#111111] group-hover:bg-black'

  return (
    <section id="video" className="w-full px-3 sm:px-6 md:px-10 py-10 md:py-16 max-w-[1180px] mx-auto">
      <div className="text-center mb-6 md:mb-8">
        <p className={`text-xs font-bold uppercase tracking-[0.2em] mb-2 ${kickerCls}`}>{kicker}</p>
        <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight text-[#111111]">{title}</h2>
      </div>
      <div className="relative w-full aspect-video rounded-2xl md:rounded-3xl overflow-hidden bg-black shadow-[0_30px_80px_rgba(15,23,42,0.18)] ring-1 ring-black/5">
        {playing ? (
          <video
            ref={ref}
            src={src}
            poster={poster}
            controls
            playsInline
            preload="none"
            onPlay={onPlay}
            onPause={onStop}
            onEnded={onStop}
            className="absolute inset-0 w-full h-full object-contain bg-black"
          />
        ) : (
          <button
            type="button"
            onClick={start}
            aria-label={`${title} : lire la vidéo (${duration})`}
            className="group absolute inset-0 w-full h-full cursor-pointer"
          >
            <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" loading="lazy" width={1280} height={720} />
            <span className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />
            <span className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-16 h-16 md:w-24 md:h-24 rounded-full text-white shadow-2xl transition-all group-hover:scale-110 ${btnCls}`}>
              <Play className="w-7 h-7 md:w-10 md:h-10 ml-1 fill-current" />
            </span>
            <span className="absolute right-3 bottom-3 md:right-5 md:bottom-5 px-3 py-1 rounded-full bg-black/70 text-white text-xs md:text-sm font-semibold">{duration}</span>
          </button>
        )}
      </div>
    </section>
  )
}
