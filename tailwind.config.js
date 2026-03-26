/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#00E676',
        'bg-dark': '#020617',
        'bg-card': '#0f172a',
        'text-light': '#f1f5f9',
        'business-primary': '#493627',
        'business-background-light': '#fbfaf9',
        'business-background-dark': '#1c1916',
      },
      fontFamily: {
        'business-display': ['Manrope', 'sans-serif'],
        'business-serif': ['Playfair Display', 'serif'],
      },
      keyframes: {
        wiggle: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '15%': { transform: 'rotate(12deg)' },
          '30%': { transform: 'rotate(-10deg)' },
          '45%': { transform: 'rotate(6deg)' },
          '60%': { transform: 'rotate(-4deg)' },
          '75%': { transform: 'rotate(2deg)' },
        },
        'scroll-left': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'scroll-right': {
          '0%': { transform: 'translateX(-50%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
      animation: {
        wiggle: 'wiggle 1s ease-in-out infinite',
        'scroll-left': 'scroll-left 30s linear infinite',
        'scroll-right': 'scroll-right 30s linear infinite',
      },
    },
  },
  plugins: [],
}
