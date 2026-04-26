import { CSSProperties } from 'react'

const PRIMARY_DARK = '#1b1c1b'
const PRIMARY_BG = '#fbf9f8'
const ACCENT = '#006c49'
const PURPLE = '#635bff'
const MUTED = '#444748'
const SOFT = '#eae8e7'

interface PreviewProps {
  type: 'booking' | 'capture'
  title: string
  subtitle: string
  priceLabel: string | null
  duration: number | null
  ctaLabel: string
  initials: string
  avatarShape: 'circle' | 'square'
  fallbackBg: string
  bgVariant: 'booking' | 'capture'
}

function OGCard({ type, title, subtitle, priceLabel, duration, ctaLabel, initials, avatarShape, fallbackBg, bgVariant }: PreviewProps) {
  const blob1Color = bgVariant === 'booking' ? `${PURPLE}11` : `${ACCENT}11`
  const blob2Color = bgVariant === 'booking' ? `${ACCENT}0d` : `${PURPLE}0d`
  const titleSize = title.length > 40 ? 64 : 78

  const containerStyle: CSSProperties = {
    width: 1200,
    height: 630,
    background: PRIMARY_BG,
    padding: '64px 72px',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  }

  return (
    <div style={containerStyle}>
      <div style={{ position: 'absolute', top: -120, right: -120, width: 400, height: 400, borderRadius: '50%', background: blob1Color }} />
      <div style={{ position: 'absolute', bottom: -160, left: -80, width: 320, height: 320, borderRadius: '50%', background: blob2Color }} />

      {/* Top */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <img src="/closeos-business-logo-ecrit.png" alt="CloseOS" style={{ height: 60, objectFit: 'contain' }} />
          <span style={{ background: SOFT, color: MUTED, padding: '8px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase' }}>
            {type === 'booking' ? 'Lien de réservation' : 'Inscription'}
          </span>
        </div>
        {priceLabel && (
          <div style={{ background: PRIMARY_DARK, color: 'white', padding: '14px 22px', borderRadius: 999, fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>
            {priceLabel}
          </div>
        )}
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 22, position: 'relative', zIndex: 1, marginTop: 20 }}>
        <h1 style={{ fontSize: titleSize, lineHeight: 1.05, fontWeight: 800, color: PRIMARY_DARK, margin: 0, letterSpacing: -1.5, maxWidth: 980 }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 30, color: MUTED, margin: 0, fontWeight: 500, maxWidth: 980, lineHeight: 1.3 }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Bottom */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: avatarShape === 'circle' ? '50%' : 16,
            background: fallbackBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 800,
            fontSize: 28,
            letterSpacing: -0.5,
            border: '3px solid white',
            boxShadow: `0 0 0 3px ${SOFT}`,
          }}>
            {initials}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {duration && <span style={{ fontSize: 18, color: MUTED, fontWeight: 700 }}>{duration} min</span>}
            <span style={{ fontSize: 18, color: MUTED, fontWeight: 600 }}>closeos.fr</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: PRIMARY_DARK, color: 'white', padding: '18px 30px', borderRadius: 999, fontSize: 24, fontWeight: 800, letterSpacing: -0.4 }}>
          {ctaLabel}
          <span style={{ fontSize: 22, marginLeft: 4 }}>→</span>
        </div>
      </div>
    </div>
  )
}

export function OGPreview() {
  return (
    <div style={{ background: '#2a2a2a', minHeight: '100vh', padding: '40px 20px', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Aperçu OG — CloseOS</h1>
        <p style={{ fontSize: 14, opacity: 0.6, marginBottom: 40 }}>
          Format 1200×630 (taille OG standard). Le rendu réel via Satori (@vercel/og) sera très proche.
        </p>

        <h2 style={{ fontSize: 18, fontWeight: 800, margin: '24px 0 8px' }}>1. Booking — payant</h2>
        <p style={{ fontSize: 12, opacity: 0.5, marginBottom: 16 }}>/book/abc123 — Audit ClosersLab — 60 min — 49€</p>
        <OGCard
          type="booking"
          bgVariant="booking"
          title="Réserver avec Thomas Shamoev"
          subtitle="Audit ClosersLab — Diagnostic de ton activité de closer en 60 min"
          priceLabel="49€"
          duration={60}
          ctaLabel="Payer & réserver"
          initials="TS"
          avatarShape="circle"
          fallbackBg={PURPLE}
        />

        <h2 style={{ fontSize: 18, fontWeight: 800, margin: '60px 0 8px' }}>2. Booking — gratuit</h2>
        <p style={{ fontSize: 12, opacity: 0.5, marginBottom: 16 }}>/book/xyz789 — Découverte — 30 min</p>
        <OGCard
          type="booking"
          bgVariant="booking"
          title="Réserver avec Sophie Veyrenc"
          subtitle="Découverte — Premier appel pour discuter de ton projet"
          priceLabel={null}
          duration={30}
          ctaLabel="Réserver"
          initials="SV"
          avatarShape="circle"
          fallbackBg={PURPLE}
        />

        <h2 style={{ fontSize: 18, fontWeight: 800, margin: '60px 0 8px' }}>3. Capture — payante</h2>
        <p style={{ fontSize: 12, opacity: 0.5, marginBottom: 16 }}>/capture/audit60 — ClosersLab — 49€</p>
        <OGCard
          type="capture"
          bgVariant="capture"
          title="Débloque-toi en 1 audit de 60 min"
          subtitle="ClosersLab — L'accompagnement anti-bullshit"
          priceLabel="49€"
          duration={null}
          ctaLabel="Payer & réserver"
          initials="CL"
          avatarShape="square"
          fallbackBg={ACCENT}
        />

        <h2 style={{ fontSize: 18, fontWeight: 800, margin: '60px 0 8px' }}>4. Capture — sans RDV (inscription)</h2>
        <p style={{ fontSize: 12, opacity: 0.5, marginBottom: 16 }}>/capture/inscription-newsletter — gratuit</p>
        <OGCard
          type="capture"
          bgVariant="capture"
          title="Rejoins la communauté CloserLab"
          subtitle="Reçois chaque semaine les meilleures techniques de closing"
          priceLabel={null}
          duration={null}
          ctaLabel="S'inscrire"
          initials="CL"
          avatarShape="square"
          fallbackBg={ACCENT}
        />
      </div>
    </div>
  )
}
