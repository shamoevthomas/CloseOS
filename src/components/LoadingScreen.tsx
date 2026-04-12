import { useState, useEffect, useRef } from 'react'

const funFactsFr = [
    "Le saviez-vous ? CloseOS est né dans un jardin, en plein déblayage de feuilles mortes. 🍂",
    "Le saviez-vous ? CloseOS a été fondé par Thomas Shamoev, alors âgé de seulement 19 ans. 🚀",
    "Le saviez-vous ? CloseOS est le premier outil du marché à centraliser l'ensemble du closing. 🎯",
    "Le saviez-vous ? À l'origine, CloseOS était uniquement destiné aux closers. Aujourd'hui, il va bien au-delà. 💡",
    "Le saviez-vous ? CloseOS permet de libérer jusqu'à 10h par semaine pour chaque closer. ⏱️",
]

const funFactsEn = [
    "Did you know? CloseOS was born in a garden, while clearing fallen leaves. 🍂",
    "Did you know? CloseOS was founded by Thomas Shamoev, who was only 19 years old. 🚀",
    "Did you know? CloseOS is the first tool on the market to centralize the entire closing process. 🎯",
    "Did you know? Originally, CloseOS was only for closers. Today, it goes far beyond. 💡",
    "Did you know? CloseOS can free up to 10 hours per week for each closer. ⏱️",
]

export function LoadingScreen() {
    const lang = (localStorage.getItem('closeos_lang') || 'fr') as 'fr' | 'en'
    const funFacts = lang === 'fr' ? funFactsFr : funFactsEn
    const [currentIndex, setCurrentIndex] = useState(0)
    const [fade, setFade] = useState(true)
    const isPaused = useRef(false)

    useEffect(() => {
        const interval = setInterval(() => {
            if (isPaused.current) return

            setFade(false)
            setTimeout(() => {
                setCurrentIndex((prev) => (prev + 1) % funFacts.length)
                setFade(true)
            }, 400) // Durée du fade-out avant changement
        }, 3000)

        return () => clearInterval(interval)
    }, [])

    return (
        <div className="loading-screen">
            {/* Cercles animés en arrière-plan */}
            <div className="loading-screen__orbs">
                <div className="loading-screen__orb loading-screen__orb--1" />
                <div className="loading-screen__orb loading-screen__orb--2" />
                <div className="loading-screen__orb loading-screen__orb--3" />
            </div>

            <div className="loading-screen__content">
                {/* Logo / Titre */}
                <div className="loading-screen__logo">
                    <span className="loading-screen__logo-text">Close</span>
                    <span className="loading-screen__logo-accent">OS</span>
                </div>

                {/* Spinner animé */}
                <div className="loading-screen__spinner">
                    <div className="loading-screen__spinner-ring" />
                </div>

                {/* Texte principal */}
                <p className="loading-screen__status">{lang === 'fr' ? 'Connexion en cours…' : 'Connecting…'}</p>

                {/* Fun facts */}
                <div
                    className={`loading-screen__fact ${fade ? 'loading-screen__fact--visible' : 'loading-screen__fact--hidden'}`}
                    onMouseEnter={() => { isPaused.current = true }}
                    onMouseLeave={() => { isPaused.current = false }}
                >
                    {funFacts[currentIndex]}
                </div>
            </div>

            <style>{`
        .loading-screen {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #111111;
          overflow: hidden;
        }

        .loading-screen__orbs {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .loading-screen__orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.25;
        }

        .loading-screen__orb--1 {
          width: 400px;
          height: 400px;
          background: #10b981;
          top: -100px;
          right: -100px;
          animation: loading-orbit1 8s ease-in-out infinite;
        }

        .loading-screen__orb--2 {
          width: 300px;
          height: 300px;
          background: #059669;
          bottom: -80px;
          left: -80px;
          animation: loading-orbit2 10s ease-in-out infinite;
        }

        .loading-screen__orb--3 {
          width: 200px;
          height: 200px;
          background: #34d399;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation: loading-orbit3 6s ease-in-out infinite;
        }

        @keyframes loading-orbit1 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-60px, 40px); }
        }

        @keyframes loading-orbit2 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(50px, -30px); }
        }

        @keyframes loading-orbit3 {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.3); }
        }

        .loading-screen__content {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 28px;
          padding: 0 24px;
          text-align: center;
        }

        .loading-screen__logo {
          font-size: 2.8rem;
          font-weight: 800;
          letter-spacing: -1px;
          user-select: none;
        }

        .loading-screen__logo-text {
          color: #f1f5f9;
        }

        .loading-screen__logo-accent {
          background: linear-gradient(135deg, #10b981, #059669);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .loading-screen__spinner {
          width: 44px;
          height: 44px;
          position: relative;
        }

        .loading-screen__spinner-ring {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 3px solid rgba(16, 185, 129, 0.15);
          border-top-color: #10b981;
          animation: loading-spin 0.9s linear infinite;
        }

        @keyframes loading-spin {
          to { transform: rotate(360deg); }
        }

        .loading-screen__status {
          color: #94a3b8;
          font-size: 1rem;
          font-weight: 500;
          margin: 0;
          letter-spacing: 0.5px;
        }

        .loading-screen__fact {
          max-width: 480px;
          color: #64748b;
          font-size: 0.875rem;
          line-height: 1.6;
          min-height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.4s ease;
          cursor: default;
        }

        .loading-screen__fact--visible {
          opacity: 1;
        }

        .loading-screen__fact--hidden {
          opacity: 0;
        }
      `}</style>
        </div>
    )
}
