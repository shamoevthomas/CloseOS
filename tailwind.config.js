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
      },
    },
  },
  plugins: [],
}
