import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['local.closeos.dev'],
    proxy: {
      '/api': {
        // Par défaut la prod, pour ne rien changer au flux habituel.
        // `npm run dev:local` pointe sur le serveur d'API local (scripts/dev-api.ts),
        // utile pour tester une route pas encore déployée.
        target: process.env.VITE_API_PROXY || 'https://close-os.vercel.app',
        changeOrigin: true,
        secure: !process.env.VITE_API_PROXY,
      }
    }
  },
  build: {
    modulePreload: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'charts': ['recharts'],
          'pdf': ['jspdf', 'jspdf-autotable'],
          'motion': ['motion'],
          'supabase': ['@supabase/supabase-js'],
          'icons': ['lucide-react'],
          'oauth': ['@react-oauth/google'],
          'crop': ['react-easy-crop'],
          'phone': ['libphonenumber-js'],
        }
      }
    }
  }
})
