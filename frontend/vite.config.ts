import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // El front llama a /api/... y Vite lo reenvia al backend (uvicorn en el 8000).
    // Asi no importa en que puerto corra el front ni hay que configurar CORS.
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
