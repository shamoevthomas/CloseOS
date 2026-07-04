import { useEffect, useRef } from 'react'
import createGlobe from 'cobe'

export interface GlobeMarker {
  location: [number, number]
  size: number
}

interface Props {
  markers: GlobeMarker[]
  size?: number
}

// Globe 3D sombre à halo rouge — marqueurs des visiteurs par pays.
export function VisitorGlobe({ markers, size = 360 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointerInteracting = useRef<number | null>(null)
  const pointerInteractionMovement = useRef(0)
  const phiRef = useRef(0)
  const rotationRef = useRef(0)
  const markersRef = useRef<GlobeMarker[]>(markers)

  // garder les marqueurs à jour sans recréer le globe
  useEffect(() => { markersRef.current = markers }, [markers])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let width = size

    const globe = createGlobe(canvas, {
      devicePixelRatio: 2,
      width: width * 2,
      height: width * 2,
      phi: 0,
      theta: 0.25,
      dark: 1,
      diffuse: 1.1,
      mapSamples: 16000,
      mapBrightness: 5,
      baseColor: [0.28, 0.16, 0.16],
      markerColor: [1, 0.25, 0.25],
      glowColor: [0.75, 0.16, 0.16],
      markers: markersRef.current,
      onRender: (state: any) => {
        // rotation auto + interaction pointeur
        if (pointerInteracting.current === null) phiRef.current += 0.004
        state.phi = phiRef.current + rotationRef.current
        state.width = width * 2
        state.height = width * 2
        state.markers = markersRef.current
      },
    })

    return () => globe.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size])

  return (
    <div
      className="relative select-none"
      style={{ width: size, height: size, maxWidth: '100%', aspectRatio: '1' }}
    >
      {/* halo rouge diffus derrière le globe */}
      <div
        className="absolute inset-0 rounded-full blur-3xl -z-10 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(220,38,38,0.35) 0%, rgba(220,38,38,0) 65%)' }}
      />
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size, maxWidth: '100%', cursor: 'grab', contain: 'layout paint size' }}
        onPointerDown={(e) => {
          pointerInteracting.current = e.clientX - pointerInteractionMovement.current
          if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'
        }}
        onPointerUp={() => {
          pointerInteracting.current = null
          if (canvasRef.current) canvasRef.current.style.cursor = 'grab'
        }}
        onPointerOut={() => {
          pointerInteracting.current = null
          if (canvasRef.current) canvasRef.current.style.cursor = 'grab'
        }}
        onPointerMove={(e) => {
          if (pointerInteracting.current !== null) {
            const delta = e.clientX - pointerInteracting.current
            pointerInteractionMovement.current = delta
            rotationRef.current = delta / 200
          }
        }}
      />
    </div>
  )
}
