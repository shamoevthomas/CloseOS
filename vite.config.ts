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
        target: 'https://close-os.vercel.app',
        changeOrigin: true,
        secure: true,
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'charts': ['recharts'],
          'pdf': ['jspdf', 'jspdf-autotable'],
          'motion': ['motion'],
          'supabase': ['@supabase/supabase-js'],
        }
      }
    }
  }
})
