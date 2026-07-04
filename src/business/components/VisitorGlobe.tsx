import { useEffect, useRef, useState } from 'react'
// @ts-ignore — react-globe.gl n'expose pas de types
import Globe from 'react-globe.gl'

interface Props {
  // map code pays ISO2 en minuscules -> nombre de visiteurs (ex: { fr: 131, us: 3 })
  counts: Record<string, number>
  height?: number
}

// Vrai globe 3D (react-globe.gl) — continents en relief, pays colorés par trafic, atmosphère rouge.
export function VisitorGlobe({ counts, height = 380 }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<any>(null)
  const [features, setFeatures] = useState<any[]>([])
  const [width, setWidth] = useState(420)

  useEffect(() => {
    fetch('/countries.geojson')
      .then((r) => r.json())
      .then((d) => setFeatures(d.features || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const measure = () => { if (wrapRef.current) setWidth(wrapRef.current.clientWidth) }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  useEffect(() => {
    const g = globeRef.current
    if (!g || features.length === 0) return
    g.controls().autoRotate = true
    g.controls().autoRotateSpeed = 0.35
    g.controls().enableZoom = false
    g.pointOfView({ lat: 30, lng: 0, altitude: 2.2 })
    try {
      const mat = g.globeMaterial()
      mat.color.set('#0a0a0a')
      mat.emissive.set('#1c1c1c')
      mat.emissiveIntensity = 1
      mat.shininess = 0
    } catch { /* ignore */ }
  }, [features])

  // Code pays alpha-2 fiable (ISO_A2 vaut "-99" pour certains pays comme la France).
  const iso2 = (feat: any) => {
    const p = feat.properties
    let c = p.ISO_A2
    if (!c || c === '-99') c = p.ISO_A2_EH
    if (!c || c === '-99') c = p.WB_A2
    return (c || '').toLowerCase()
  }

  const max = Math.max(1, ...Object.values(counts))
  const valOf = (feat: any) => counts[iso2(feat)] || 0
  const capColor = (feat: any) => {
    const v = valOf(feat)
    if (!v) return 'rgba(120, 120, 120, 0.35)'
    return `rgba(220, 38, 38, ${(0.35 + 0.65 * (v / max)).toFixed(3)})`
  }
  const altOf = (feat: any) => {
    const v = valOf(feat)
    return v ? 0.02 + 0.14 * (v / max) : 0.006
  }
  const label = (feat: any) =>
    `<div style="font:600 12px monospace;background:#0e0e0e;color:#f4f1ec;padding:5px 9px;border-radius:6px">${feat.properties.ADMIN} — ${valOf(feat)} clic(s)</div>`

  return (
    <div ref={wrapRef} style={{ width: '100%', minHeight: height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {features.length === 0 ? (
        <div style={{ height, display: 'flex', alignItems: 'center' }} className="text-sm text-stone-400 dark:text-neutral-500">
          Chargement du globe…
        </div>
      ) : (
        <Globe
          ref={globeRef}
          width={width}
          height={height}
          backgroundColor="rgba(0,0,0,0)"
          atmosphereColor="#dc2626"
          atmosphereAltitude={0.2}
          polygonsData={features}
          polygonCapColor={capColor}
          polygonSideColor={() => 'rgba(220, 38, 38, 0.12)'}
          polygonStrokeColor={() => 'rgba(150, 150, 150, 0.4)'}
          polygonAltitude={altOf}
          polygonLabel={label}
          polygonsTransitionDuration={300}
        />
      )}
    </div>
  )
}
