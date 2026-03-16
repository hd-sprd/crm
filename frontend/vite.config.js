import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',       // accept connections from outside localhost
    port: 5173,
    allowedHosts: true,    // allow tunnel hostnames (*.loca.lt, *.trycloudflare.com, etc.)
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        // Rewrite Origin so backend CORS passes even when accessed via tunnel
        headers: { origin: 'http://localhost:5173' },
      },
    },
  },
})
